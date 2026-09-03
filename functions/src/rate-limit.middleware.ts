// Rate limiting middleware
// Tracks requests per user per minute in Firestore.
// Rejects with 429 when threshold is exceeded to prevent abuse and cost explosion.
//
// Design: using Firestore counters (not Redis) keeps the dependency count low
// for initial deployment. Replace with Redis/Memorystore for higher throughput.

import type { Request, Response, NextFunction } from "express";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

const RATE_LIMIT_REQUESTS_PER_MINUTE = 20;

/**
 * Per-user rate limiter using a Firestore document as a rolling window counter.
 * The doc at /rateLimits/{uid} tracks: count, windowStart.
 * On each request, if windowStart is > 60s ago, the window resets.
 * If count >= limit within the window, returns 429.
 */
export async function rateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const uid = req.uid;
  if (!uid) {
    // Should be impossible if requireAuth ran first, but fail closed
    res.status(401).json({ code: "unauthenticated", message: "Not authenticated." });
    return;
  }

  const db      = getFirestore();
  const ref     = db.collection("rateLimits").doc(uid);
  const now     = Date.now();
  const windowMs = 60 * 1000;

  try {
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);

      if (!snap.exists) {
        tx.set(ref, { count: 1, windowStart: now });
        return { allowed: true, remaining: RATE_LIMIT_REQUESTS_PER_MINUTE - 1 };
      }

      const data        = snap.data()!;
      const windowStart = data.windowStart instanceof Timestamp
        ? data.windowStart.toMillis()
        : (data.windowStart as number);

      if (now - windowStart > windowMs) {
        // Window expired — reset
        tx.set(ref, { count: 1, windowStart: now });
        return { allowed: true, remaining: RATE_LIMIT_REQUESTS_PER_MINUTE - 1 };
      }

      const newCount = (data.count as number) + 1;
      if (newCount > RATE_LIMIT_REQUESTS_PER_MINUTE) {
        return { allowed: false, remaining: 0 };
      }

      tx.update(ref, { count: FieldValue.increment(1) });
      return { allowed: true, remaining: RATE_LIMIT_REQUESTS_PER_MINUTE - newCount };
    });

    if (!result.allowed) {
      console.warn("[rateLimit] Rate limit exceeded.", { uid });
      res.setHeader("Retry-After", "60");
      res.status(429).json({
        code:    "rate-limit-exceeded",
        message: "Too many requests. Please wait a minute before trying again.",
      });
      return;
    }

    next();
  } catch (err) {
    // H-3 FIX: Fail CLOSED on Firestore errors.
    // An attacker who can cause Firestore failures (quota exhaustion, network partition)
    // should NOT be able to bypass rate limiting and call expensive Gemini endpoints.
    // We distinguish read errors (can still count) from write errors (fail safe).
    const errMsg = (err as Error).message ?? "unknown";
    console.error("[rateLimit] Rate limit check failed — rejecting request as safe default.", { error: errMsg });
    res.status(503).json({
      code:    "rate-limit-unavailable",
      message: "Service temporarily unavailable. Please try again in a moment.",
    });
  }
}

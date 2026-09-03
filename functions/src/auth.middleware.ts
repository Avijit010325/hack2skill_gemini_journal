// Auth middleware — verifies Firebase ID token on every request.
// Fails closed: any request without a valid token is rejected with 401.
// Never trusts client-supplied UID — always uses the verified token's uid.

import type { Request, Response, NextFunction } from "express";
import { getAuth } from "firebase-admin/auth";

// Extend Express Request to carry the verified UID
declare global {
  namespace Express {
    interface Request {
      uid?: string;
    }
  }
}

/**
 * Express middleware that:
 * 1. Extracts the Bearer token from Authorization header.
 * 2. Verifies it server-side via Firebase Admin SDK.
 * 3. Rejects with 401 if missing, expired, or invalid.
 * 4. Attaches `req.uid` (the verified UID) for downstream use.
 *
 * NEVER use a client-supplied UID from the request body/query — always
 * use `req.uid` which comes from the verified token.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization ?? "";

  if (!authHeader.startsWith("Bearer ")) {
    // Log auth failure without PII
    console.warn("[auth] Missing or malformed Authorization header.", {
      method: req.method,
      path:   req.path,
      ip:     req.ip,
    });
    res.status(401).json({ code: "unauthenticated", message: "Authorization token required." });
    return;
  }

  const idToken = authHeader.slice(7);

  try {
    const decoded = await getAuth().verifyIdToken(idToken, /* checkRevoked= */ true);
    req.uid = decoded.uid;
    next();
  } catch (err) {
    const code = (err as { code?: string }).code ?? "unknown";

    // Log security event — no PII, no token value
    console.warn("[auth] Token verification failed.", { code, path: req.path });

    if (code === "auth/id-token-expired" || code === "auth/argument-error") {
      res.status(401).json({ code: "token-expired", message: "Token expired. Please sign in again." });
    } else if (code === "auth/id-token-revoked") {
      res.status(401).json({ code: "token-revoked", message: "Session revoked. Please sign in again." });
    } else {
      res.status(401).json({ code: "unauthenticated", message: "Invalid authorization token." });
    }
  }
}

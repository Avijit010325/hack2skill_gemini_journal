// Firestore hooks — real-time listeners scoped to the authenticated user.
// All queries are filtered by the authenticated UID — no cross-user data access.

import { useEffect, useState, useCallback } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthProvider";
import type { JournalSession, JournalMessage, SessionSummary } from "@/lib/types";

// ── Helper: Firestore timestamp → Date ───────────────────

function toDate(ts: Timestamp | Date | undefined): Date {
  if (!ts) return new Date();
  if (ts instanceof Date) return ts;
  return ts.toDate();
}

// ── useSessions ───────────────────────────────────────────

export function useSessions() {
  const { user }    = useAuth();
  const [sessions,  setSessions]  = useState<JournalSession[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    // Query is scoped to /users/{uid}/sessions — Firestore rules enforce this
    const q = query(
      collection(db, "users", user.uid, "sessions"),
      orderBy("updatedAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({
          id:           d.id,
          title:        d.data().title ?? "Untitled Entry",
          content:      d.data().content ?? "",
          startedAt:    toDate(d.data().startedAt),
          updatedAt:    toDate(d.data().updatedAt),
          mood:         d.data().mood,
          tags:         d.data().tags ?? [],
          isComplete:   d.data().isComplete ?? false,
          messageCount: d.data().messageCount ?? 0,
        }) satisfies JournalSession);
        setSessions(docs);
        setLoading(false);
      },
      (err) => {
        console.error("[useSessions] Firestore error:", err.code);
        setError("Failed to load sessions. Please refresh.");
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [user]);

  /**
   * Create a new journaling session. Returns the new session ID.
   */
  const createSession = useCallback(async (): Promise<string> => {
    if (!user) throw new Error("Not authenticated");

    const ref = await addDoc(
      collection(db, "users", user.uid, "sessions"),
      {
        title:        "New Entry",
        startedAt:    serverTimestamp(),
        updatedAt:    serverTimestamp(),
        isComplete:   false,
        messageCount: 0,
      },
    );

    return ref.id;
  }, [user]);

  /**
   * Mark a session as complete (triggers summarization).
   */
  const completeSession = useCallback(async (sessionId: string) => {
    if (!user) throw new Error("Not authenticated");

    await updateDoc(
      doc(db, "users", user.uid, "sessions", sessionId),
      { isComplete: true, updatedAt: serverTimestamp() },
    );
  }, [user]);

  /**
   * Update session title
   */
  const updateSessionTitle = useCallback(async (sessionId: string, title: string) => {
    if (!user) throw new Error("Not authenticated");
    await updateDoc(
      doc(db, "users", user.uid, "sessions", sessionId),
      { title, updatedAt: serverTimestamp() },
    );
  }, [user]);

  /**
   * Update session content (for rich text)
   */
  const updateSessionContent = useCallback(async (sessionId: string, content: string) => {
    if (!user) throw new Error("Not authenticated");
    await updateDoc(
      doc(db, "users", user.uid, "sessions", sessionId),
      { content, updatedAt: serverTimestamp() },
    );
  }, [user]);

  /**
   * Delete a session
   */
  const deleteSession = useCallback(async (sessionId: string) => {
    if (!user) throw new Error("Not authenticated");
    
    // In a real app we'd also delete subcollections (messages), 
    // but deleting the doc removes it from this query.
    const { deleteDoc } = await import("firebase/firestore");
    await deleteDoc(doc(db, "users", user.uid, "sessions", sessionId));
  }, [user]);

  return { sessions, loading, error, createSession, completeSession, updateSessionTitle, updateSessionContent, deleteSession };
}

// ── useMessages ───────────────────────────────────────────

export function useMessages(sessionId: string | undefined) {
  const { user }   = useAuth();
  const [messages, setMessages] = useState<JournalMessage[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!user || !sessionId) return;

    // Note: messages are written by the backend only — client read-only.
    const q = query(
      collection(db, "users", user.uid, "sessions", sessionId, "messages"),
      orderBy("createdAt", "asc"),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({
        id:        d.id,
        sessionId,
        role:      d.data().role as "user" | "model",
        content:   d.data().content ?? "",
        createdAt: toDate(d.data().createdAt),
      }) satisfies JournalMessage);
      setMessages(docs);
      setLoading(false);
    });

    return unsubscribe;
  }, [user, sessionId]);

  return { messages, loading };
}

// ── useSummaries ──────────────────────────────────────────

export function useSummaries() {
  const { user }     = useAuth();
  const [summaries,  setSummaries]  = useState<SessionSummary[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "users", user.uid, "summaries"),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({
          id:          d.id,
          sessionId:   d.data().sessionId,
          summaryText: d.data().summaryText ?? "",
          keyThemes:   d.data().keyThemes ?? [],
          sentiment:   d.data().sentiment ?? "neutral",
          createdAt:   toDate(d.data().createdAt),
        }) satisfies SessionSummary);
        setSummaries(docs);
        setLoading(false);
      },
      (err) => {
        console.error("[useSummaries] Firestore error:", err.code);
        setError("Failed to load insights.");
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [user]);

  return { summaries, loading, error };
}

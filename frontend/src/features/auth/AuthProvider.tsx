// AuthProvider — wraps Firebase Auth in a typed React context.
// Handles token refresh lifecycle automatically through Firebase SDK.

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  type User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// ── Context shape ─────────────────────────────────────────

interface AuthContextValue {
  user:           User | null;
  loading:        boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail:  (email: string, password: string) => Promise<void>;
  signUpWithEmail:  (email: string, password: string, displayName: string) => Promise<void>;
  signOut:          () => Promise<void>;
  error:            string | null;
  clearError:       () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Auth Provider ─────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to auth state changes — Firebase handles token refresh internally
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  /**
   * Ensure a user profile document exists in Firestore.
   * Uses setDoc with merge:true so subsequent sign-ins don't overwrite existing data.
   */
  async function ensureUserProfile(fbUser: User) {
    const userRef = doc(db, "users", fbUser.uid);
    await setDoc(
      userRef,
      {
        displayName: fbUser.displayName,
        photoURL:    fbUser.photoURL,
        email:       fbUser.email,
        createdAt:   serverTimestamp(),
      },
      { merge: true },
    );
  }

  async function signInWithGoogle() {
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      // Popup is more reliable on localhost dev — no cross-origin redirect needed.
      const result = await signInWithPopup(auth, provider);
      await ensureUserProfile(result.user);
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      // User closing the popup is not an error worth showing
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setError(getFriendlyError(err));
      }
    }
  }

  async function signInWithEmail(email: string, password: string) {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(getFriendlyError(err));
    }
  }

  async function signUpWithEmail(email: string, password: string, displayName: string) {
    setError(null);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName });
      await ensureUserProfile({ ...result.user, displayName });
    } catch (err) {
      setError(getFriendlyError(err));
    }
  }

  async function signOut() {
    setError(null);
    await firebaseSignOut(auth);
  }

  function clearError() { setError(null); }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

// ── Error mapping ─────────────────────────────────────────

function getFriendlyError(err: unknown): string {
  if (typeof err !== "object" || err === null) return "An unexpected error occurred.";
  const code = (err as { code?: string }).code ?? "";
  const map: Record<string, string> = {
    "auth/user-not-found":            "No account found with that email.",
    "auth/wrong-password":            "Incorrect password. Please try again.",
    "auth/invalid-credential":        "Wrong email or password. If you signed up with Google, use \"Continue with Google\" instead.",
    "auth/email-already-in-use":      "An account with this email already exists.",
    "auth/weak-password":             "Password should be at least 6 characters.",
    "auth/invalid-email":             "Please enter a valid email address.",
    "auth/popup-closed-by-user":      "Sign-in was cancelled.",
    "auth/cancelled-popup-request":   "Sign-in was cancelled.",
    "auth/popup-blocked":             "Popup was blocked. Please allow popups for this site and try again.",
    "auth/network-request-failed":    "Network error. Please check your connection.",
    "auth/too-many-requests":         "Too many attempts. Please wait a moment and try again.",
    "auth/operation-not-allowed":     "Google sign-in is not enabled. Enable it in Firebase Console → Authentication → Sign-in providers.",
    "auth/invalid-api-key":           "Firebase is misconfigured. Please check your .env.local file.",
  };
  return map[code] ?? `Something went wrong (${code || "unknown"}). Please try again.`;
}

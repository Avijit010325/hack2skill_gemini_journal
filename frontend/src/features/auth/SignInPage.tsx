// SignInPage — Google + email/password auth with glass card layout

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { Mail, Lock, User, Eye, EyeOff, PenLine } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassInput } from "@/components/ui/GlassInput";

type AuthMode = "signin" | "signup";

export function SignInPage() {
  const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, error, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode,        setMode]        = useState<AuthMode>("signin");
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPw,      setShowPw]      = useState(false);
  const [submitting,  setSubmitting]  = useState(false);

  // M-1 FIX: Validate redirect destination is same-origin.
  // If an attacker crafts a URL with an external 'from' path, we discard it.
  // We read from React Router state (not query params), but future-proof anyway.
  function getSafeRedirect(): string {
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    if (!from) return "/";
    // Only allow paths that start with / and don't start with // (protocol-relative)
    if (from.startsWith("/") && !from.startsWith("//")) return from;
    return "/";
  }

  // Redirect once authenticated
  useEffect(() => {
    if (!loading && user) navigate(getSafeRedirect(), { replace: true });
  }, [user, loading, navigate]);

  // Clear errors when switching modes
  useEffect(() => { clearError(); }, [mode]);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    if (mode === "signin") {
      await signInWithEmail(email, password);
    } else {
      await signUpWithEmail(email, password, displayName);
    }
    setSubmitting(false);
  }

  async function handleGoogle() {
    setSubmitting(true);
    await signInWithGoogle();
    setSubmitting(false);
  }

  return (
    <div
      style={{
        minHeight:      "100dvh",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        padding:        "var(--space-4)",
      }}
    >
      <GlassCard
        sheen
        style={{
          width:     "100%",
          maxWidth:  "440px",
          padding:   "var(--space-10)",
        }}
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0,  scale: 1    }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Logo + title */}
        <div style={{ textAlign: "center", marginBottom: "var(--space-8)" }}>
          <div
            style={{
              width:          "56px",
              height:         "56px",
              borderRadius:   "var(--radius-md)",
              background:     "var(--accent)",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              margin:         "0 auto var(--space-4)",
              boxShadow:      "0 8px 24px var(--accent-glow)",
            }}
          >
            <PenLine size={28} color="white" />
          </div>
          <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: "var(--space-1)" }}>
            Personal Journal
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
            Your private space to think, reflect, and grow.
          </p>
        </div>

        {/* Mode tabs */}
        <div
          role="tablist"
          style={{
            display:       "flex",
            gap:           "var(--space-1)",
            background:    "var(--glass-bg)",
            borderRadius:  "var(--radius-md)",
            padding:       "var(--space-1)",
            marginBottom:  "var(--space-6)",
          }}
        >
          {(["signin", "signup"] as AuthMode[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              style={{
                flex:          1,
                padding:       "var(--space-2)",
                borderRadius:  "calc(var(--radius-md) - 2px)",
                border:        "none",
                background:    mode === m ? "var(--glass-bg-active)" : "transparent",
                color:         mode === m ? "var(--text-primary)" : "var(--text-muted)",
                fontWeight:    mode === m ? 600 : 400,
                fontSize:      "var(--text-sm)",
                cursor:        "pointer",
                transition:    "background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out)",
              }}
            >
              {m === "signin" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{    opacity: 0, height: 0 }}
              style={{
                background:   "var(--danger-subtle)",
                border:       "1px solid color-mix(in oklch, var(--danger) 30%, transparent)",
                borderRadius: "var(--radius-md)",
                padding:      "var(--space-3) var(--space-4)",
                color:        "var(--danger)",
                fontSize:     "var(--text-sm)",
                marginBottom: "var(--space-4)",
                overflow:     "hidden",
              }}
              role="alert"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Email form */}
        <form onSubmit={handleEmailSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <AnimatePresence>
            {mode === "signup" && (
              <motion.div
                key="displayName"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{    opacity: 0, height: 0 }}
                style={{ overflow: "hidden" }}
              >
                <GlassInput
                  label="Your name"
                  type="text"
                  id="displayName"
                  autoComplete="name"
                  placeholder="How should Gemini address you?"
                  icon={<User size={16} />}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required={mode === "signup"}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <GlassInput
            label="Email address"
            type="email"
            id="email"
            autoComplete="email"
            placeholder="you@example.com"
            icon={<Mail size={16} />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <GlassInput
            label="Password"
            type={showPw ? "text" : "password"}
            id="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            placeholder={mode === "signin" ? "Your password" : "At least 6 characters"}
            icon={<Lock size={16} />}
            iconRight={
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                aria-label={showPw ? "Hide password" : "Show password"}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <GlassButton
            type="submit"
            variant="primary"
            size="lg"
            loading={submitting}
            style={{ width: "100%", marginTop: "var(--space-2)" }}
          >
            {mode === "signin" ? "Sign in" : "Create account"}
          </GlassButton>
        </form>

        {/* Divider */}
        <div
          style={{
            display:     "flex",
            alignItems:  "center",
            gap:         "var(--space-3)",
            margin:      "var(--space-6) 0",
            color:       "var(--text-muted)",
            fontSize:    "var(--text-sm)",
          }}
        >
          <div style={{ flex: 1, height: 1, background: "var(--glass-border)" }} />
          or continue with
          <div style={{ flex: 1, height: 1, background: "var(--glass-border)" }} />
        </div>

        {/* Google sign-in */}
        <GlassButton
          variant="ghost"
          size="lg"
          loading={submitting}
          onClick={handleGoogle}
          style={{ width: "100%" }}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          }
        >
          Continue with Google
        </GlassButton>

        <p style={{ textAlign: "center", fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "var(--space-6)" }}>
          Your journal is private and encrypted. Only you can access it.
        </p>
      </GlassCard>
    </div>
  );
}

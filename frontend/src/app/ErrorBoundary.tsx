// ErrorBoundary — graceful error UI for unexpected React errors

import React, { Component, type ErrorInfo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { AlertTriangle } from "lucide-react";

interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // M-4 FIX: Component stack includes internal file paths / component names.
    // Only log it in dev — in production it can be used for reconnaissance by
    // an attacker with console access (browser extension, XSS).
    console.error("[ErrorBoundary] Uncaught error:", error.name, error.message);
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary] Component stack:", info.componentStack);
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

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
        <GlassCard style={{ maxWidth: "480px", width: "100%", padding: "var(--space-10)", textAlign: "center" }}>
          <div
            style={{
              width:          "56px",
              height:         "56px",
              borderRadius:   "var(--radius-md)",
              background:     "var(--danger-subtle)",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              margin:         "0 auto var(--space-4)",
              color:          "var(--danger)",
            }}
          >
            <AlertTriangle size={28} />
          </div>

          <h1 style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-2)" }}>
            Something went wrong
          </h1>
          <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-6)", lineHeight: "var(--leading-relaxed)" }}>
            An unexpected error occurred. Your journal data is safe — this is just a display issue.
          </p>

          <GlassButton
            variant="primary"
            onClick={() => window.location.reload()}
          >
            Reload the app
          </GlassButton>
        </GlassCard>
      </div>
    );
  }
}

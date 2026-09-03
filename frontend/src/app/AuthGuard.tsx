// AuthGuard — redirects unauthenticated users to /login

import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { GlassSkeleton } from "@/components/ui/GlassSkeleton";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const location          = useLocation();

  if (loading) {
    return (
      <div
        style={{
          minHeight:      "100dvh",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          gap:            "var(--space-4)",
          flexDirection:  "column",
        }}
      >
        <GlassSkeleton width="48px" height="48px" radius="var(--radius-md)" />
        <GlassSkeleton width="120px" height="0.85rem" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

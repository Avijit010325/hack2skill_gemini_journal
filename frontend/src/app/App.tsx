// App Router — React Router v6 with auth guard

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { AuthGuard } from "./AuthGuard";
import { ErrorBoundary } from "./ErrorBoundary";
import { AnimatedBackground } from "./AnimatedBackground";
import { Layout } from "./Layout";
import { SignInPage } from "@/features/auth/SignInPage";
import { SessionsPage } from "@/features/sessions/SessionsPage";
import { ChatPage } from "@/features/journal/ChatPage";
import { InsightsPage } from "@/features/summaries/InsightsPage";

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <AnimatedBackground />
          <Routes>
            {/* Public */}
            <Route path="/login" element={<SignInPage />} />

            {/* Protected — all routes under Layout require auth */}
            <Route
              element={
                <AuthGuard>
                  <Layout />
                </AuthGuard>
              }
            >
              <Route index element={<SessionsPage />} />
              <Route path="session/:id" element={<ChatPage />} />
              <Route path="insights"   element={<InsightsPage />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

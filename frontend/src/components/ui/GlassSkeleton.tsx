// GlassSkeleton — shimmer loading using glass material (not generic gray boxes)

import React from "react";

interface GlassSkeletonProps {
  width?:   string | number;
  height?:  string | number;
  radius?:  string;
  className?: string;
}

export function GlassSkeleton({
  width   = "100%",
  height  = "1em",
  radius  = "var(--radius-sm)",
  className = "",
}: GlassSkeletonProps) {
  return (
    <span
      role="status"
      aria-label="Loading…"
      className={`shimmer ${className}`}
      style={{
        display:      "block",
        width,
        height,
        borderRadius: radius,
        border:       "1px solid var(--glass-border)",
      }}
    />
  );
}

/** Pre-built skeleton for session cards */
export function SessionCardSkeleton() {
  return (
    <div
      className="glass"
      style={{
        padding:    "var(--space-5)",
        display:    "flex",
        flexDirection: "column",
        gap:        "var(--space-3)",
      }}
    >
      <GlassSkeleton height="1.2rem" width="60%" />
      <GlassSkeleton height="0.85rem" width="40%" />
      <GlassSkeleton height="0.85rem" width="80%" />
    </div>
  );
}

/** Pre-built skeleton for summary cards */
export function SummaryCardSkeleton() {
  return (
    <div
      className="glass"
      style={{
        padding:    "var(--space-6)",
        display:    "flex",
        flexDirection: "column",
        gap:        "var(--space-4)",
      }}
    >
      <GlassSkeleton height="1.1rem" width="45%" />
      <GlassSkeleton height="0.85rem" />
      <GlassSkeleton height="0.85rem" width="90%" />
      <GlassSkeleton height="0.85rem" width="70%" />
      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        <GlassSkeleton height="1.5rem" width="5rem" radius="var(--radius-full)" />
        <GlassSkeleton height="1.5rem" width="4rem" radius="var(--radius-full)" />
      </div>
    </div>
  );
}

// EmptyState — warm, designed empty states (not placeholder text)

import React from "react";
import { motion } from "framer-motion";

interface EmptyStateProps {
  icon?:        React.ReactNode;
  title:        string;
  description:  string;
  action?:      React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0  }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        textAlign:      "center",
        padding:        "var(--space-16) var(--space-8)",
        gap:            "var(--space-4)",
      }}
    >
      {icon && (
        <div
          style={{
            width:          "64px",
            height:         "64px",
            borderRadius:   "var(--radius-lg)",
            background:     "var(--accent-subtle)",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            color:          "var(--accent)",
            marginBottom:   "var(--space-2)",
          }}
        >
          {icon}
        </div>
      )}

      <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600, color: "var(--text-primary)" }}>
        {title}
      </h2>

      <p style={{
        fontSize:  "var(--text-base)",
        color:     "var(--text-secondary)",
        maxWidth:  "360px",
        lineHeight: "var(--leading-relaxed)",
      }}>
        {description}
      </p>

      {action && (
        <div style={{ marginTop: "var(--space-2)" }}>
          {action}
        </div>
      )}
    </motion.div>
  );
}

// GlassInput — glass-material text input with custom focus ring

import React, { forwardRef } from "react";

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?:     string;
  error?:     string;
  icon?:      React.ReactNode;
  iconRight?: React.ReactNode;
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ label, error, icon, iconRight, className = "", id, style, ...props }, ref) => {
    const inputId = id ?? `glass-input-${Math.random().toString(36).slice(2)}`;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        {label && (
          <label
            htmlFor={inputId}
            style={{
              fontSize:   "var(--text-sm)",
              fontWeight: 500,
              color:      "var(--text-secondary)",
            }}
          >
            {label}
          </label>
        )}

        <div style={{ position: "relative" }}>
          {icon && (
            <span
              aria-hidden="true"
              style={{
                position:  "absolute",
                left:      "var(--space-4)",
                top:       "50%",
                transform: "translateY(-50%)",
                color:     "var(--text-muted)",
                display:   "flex",
                alignItems: "center",
                pointerEvents: "none",
              }}
            >
              {icon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            className={className}
            style={{
              width:          "100%",
              padding:        `var(--space-3) var(--space-4)`,
              paddingLeft:    icon     ? "var(--space-10)" : "var(--space-4)",
              paddingRight:   iconRight ? "var(--space-10)" : "var(--space-4)",
              background:     "var(--glass-bg)",
              backdropFilter: "var(--blur-clear)",
              WebkitBackdropFilter: "var(--blur-clear)",
              border:         `1px solid ${error ? "var(--danger)" : "var(--glass-border)"}`,
              borderRadius:   "var(--radius-md)",
              color:          "var(--text-primary)",
              fontSize:       "var(--text-base)",
              lineHeight:     "var(--leading-normal)",
              outline:        "none",
              transition:     `border-color var(--duration-fast) var(--ease-out),
                               box-shadow var(--duration-fast) var(--ease-out)`,
              boxShadow:      error
                ? `0 0 0 3px var(--danger-subtle), inset 0 1px 0 var(--glass-highlight)`
                : `inset 0 1px 0 var(--glass-highlight)`,
              ...style,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = error ? "var(--danger)" : "var(--accent)";
              e.currentTarget.style.boxShadow   = error
                ? `0 0 0 3px var(--danger-subtle), inset 0 1px 0 var(--glass-highlight)`
                : `0 0 0 3px var(--accent-subtle), inset 0 1px 0 var(--glass-highlight)`;
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = error ? "var(--danger)" : "var(--glass-border)";
              e.currentTarget.style.boxShadow   = `inset 0 1px 0 var(--glass-highlight)`;
              props.onBlur?.(e);
            }}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
            {...props}
          />

          {iconRight && (
            <span
              aria-hidden="true"
              style={{
                position:  "absolute",
                right:     "var(--space-4)",
                top:       "50%",
                transform: "translateY(-50%)",
                color:     "var(--text-muted)",
                display:   "flex",
                alignItems: "center",
                pointerEvents: "none",
              }}
            >
              {iconRight}
            </span>
          )}
        </div>

        {error && (
          <p
            id={`${inputId}-error`}
            role="alert"
            style={{
              fontSize: "var(--text-sm)",
              color:    "var(--danger)",
            }}
          >
            {error}
          </p>
        )}
      </div>
    );
  },
);

GlassInput.displayName = "GlassInput";

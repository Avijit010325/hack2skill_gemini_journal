// GlassButton — press-scale interaction with spring overshoot release

import React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

type ButtonVariant = "primary" | "ghost" | "danger";
type ButtonSize    = "sm" | "md" | "lg";

interface GlassButtonProps extends Omit<HTMLMotionProps<"button">, "ref"> {
  variant?:  ButtonVariant;
  size?:     ButtonSize;
  loading?:  boolean;
  icon?:     React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm gap-1.5",
  md: "px-5 py-2.5 text-base gap-2",
  lg: "px-7 py-3.5 text-lg gap-2.5",
};

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background:  "var(--accent)",
    color:       "var(--text-on-accent)",
    border:      "1px solid transparent",
    boxShadow:   "0 4px 20px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.2)",
  },
  ghost: {
    background:  "var(--glass-bg)",
    color:       "var(--text-primary)",
    border:      "1px solid var(--glass-border)",
    boxShadow:   "var(--glass-shadow-sm), inset 0 1px 0 var(--glass-highlight)",
    backdropFilter: "var(--blur-clear)",
    WebkitBackdropFilter: "var(--blur-clear)",
  },
  danger: {
    background:  "var(--danger-subtle)",
    color:       "var(--danger)",
    border:      "1px solid color-mix(in oklch, var(--danger) 30%, transparent)",
    boxShadow:   "var(--glass-shadow-sm)",
  },
};

export function GlassButton({
  variant  = "ghost",
  size     = "md",
  loading  = false,
  icon,
  children,
  className = "",
  disabled,
  style,
  ...props
}: GlassButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <motion.button
      style={{ ...variantStyles[variant], ...style }}
      className={`
        inline-flex items-center justify-center font-medium
        rounded-[var(--radius-md)] cursor-pointer select-none
        transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
        ${sizeStyles[size]} ${className}
      `}
      disabled={isDisabled}
      // Press: compress slightly
      whileTap={isDisabled ? {} : { scale: 0.97 }}
      // Spring release with subtle overshoot
      transition={{
        type:      "spring",
        stiffness: 400,
        damping:   20,
      }}
      {...props}
    >
      {loading ? (
        <span
          style={{
            width:        "1em",
            height:       "1em",
            border:       "2px solid currentColor",
            borderTopColor: "transparent",
            borderRadius: "50%",
            display:      "inline-block",
            animation:    "spin 0.7s linear infinite",
          }}
          aria-hidden="true"
        />
      ) : icon}
      {children && (
        <span style={{ lineHeight: 1 }}>{children}</span>
      )}
    </motion.button>
  );
}

// Inject spin keyframe once (avoids global CSS dependency)
if (typeof document !== "undefined") {
  const id = "__glass-spin";
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.textContent = "@keyframes spin { to { transform: rotate(360deg); } }";
    document.head.appendChild(style);
  }
}

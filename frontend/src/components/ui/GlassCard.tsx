// GlassCard — primary glass surface component
// Implements the Liquid Glass material with specular cursor sheen.

import React, { useRef, useCallback } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

interface GlassCardProps extends Omit<HTMLMotionProps<"div">, "ref"> {
  variant?: "regular" | "clear";
  /** Enable cursor-tracking specular sheen on hover */
  sheen?: boolean;
  /** Override border radius (default: var(--radius-lg)) */
  radius?: string;
  className?: string;
  children?: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

export function GlassCard({
  variant = "regular",
  sheen   = false,
  radius,
  className = "",
  children,
  style,
  ...props
}: GlassCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Update CSS custom props for specular sheen position on pointer move
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!sheen || !cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width)  * 100;
      const y = ((e.clientY - rect.top)  / rect.height) * 100;
      cardRef.current.style.setProperty("--sheen-x", `${x}%`);
      cardRef.current.style.setProperty("--sheen-y", `${y}%`);
    },
    [sheen],
  );

  const glassClass = variant === "clear" ? "glass-clear" : "glass";
  const sheenClass = sheen ? "glass-sheen" : "";

  return (
    <motion.div
      ref={cardRef}
      className={`${glassClass} ${sheenClass} ${className}`}
      style={{
        borderRadius: radius ?? "var(--radius-lg)",
        ...style,
      }}
      onPointerMove={handlePointerMove}
      {...props}
    >
      {children}
    </motion.div>
  );
}

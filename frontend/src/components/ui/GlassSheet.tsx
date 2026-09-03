// GlassSheet — modal/bottom-sheet that grows from anchor with glass backdrop

import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { GlassButton } from "./GlassButton";

interface GlassSheetProps {
  open:      boolean;
  onClose:   () => void;
  title?:    string;
  children:  React.ReactNode;
  maxWidth?: string;
}

export function GlassSheet({
  open,
  onClose,
  title,
  children,
  maxWidth = "560px",
}: GlassSheetProps) {
  // Trap focus and handle Escape key
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Prevent body scroll while sheet is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — blur fades in sync with sheet */}
          <motion.div
            key="backdrop"
            style={{
              position: "fixed",
              inset:    0,
              zIndex:   "var(--z-modal)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              background: "rgba(0, 0, 0, 0.45)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{    opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Sheet */}
          <div
            style={{
              position:       "fixed",
              inset:          0,
              zIndex:         "calc(var(--z-modal) + 1)",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              padding:        "var(--space-4)",
              pointerEvents:  "none",
            }}
          >
            <motion.div
              ref={sheetRef}
              role="dialog"
              aria-modal="true"
              aria-label={title}
              key="sheet"
              className="glass"
              style={{
                width:          "100%",
                maxWidth,
                maxHeight:      "90dvh",
                overflow:       "auto",
                pointerEvents:  "all",
                padding:        "var(--space-6)",
                borderRadius:   "var(--radius-xl)",
              }}
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1,    y: 0  }}
              exit={{    opacity: 0, scale: 0.94, y: 12 }}
              transition={{
                duration: 0.28,
                ease:     [0.22, 1, 0.36, 1],
              }}
            >
              {title && (
                <div
                  style={{
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "space-between",
                    marginBottom:   "var(--space-6)",
                  }}
                >
                  <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600 }}>
                    {title}
                  </h2>
                  <GlassButton
                    variant="ghost"
                    size="sm"
                    icon={<X size={16} />}
                    onClick={onClose}
                    aria-label="Close"
                  />
                </div>
              )}

              {children}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

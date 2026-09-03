// SessionsPage — home "/" route: session list + "New Entry" FAB

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, NotebookPen, Clock, ChevronRight, Trash2 } from "lucide-react";
import { useSessions } from "@/lib/hooks";
import { useAuth } from "@/features/auth/AuthProvider";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { SessionCardSkeleton } from "@/components/ui/GlassSkeleton";
import { formatDistanceToNow } from "date-fns";
import type { JournalSession } from "@/lib/types";

export function SessionsPage() {
  const { user }                             = useAuth();
  const { sessions, loading, createSession, deleteSession } = useSessions();
  const navigate                             = useNavigate();
  const [creating, setCreating]              = useState(false);

  async function handleNewEntry() {
    setCreating(true);
    try {
      const id = await createSession();
      navigate(`/session/${id}`);
    } catch (err) {
      console.error("[SessionsPage] Failed to create session:", err);
      setCreating(false);
    }
  }

  return (
    <div
      className="container-app"
      style={{ padding: "var(--space-8) var(--space-4)", maxWidth: "800px", margin: "0 auto" }}
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0   }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          marginBottom:   "var(--space-8)",
          flexWrap:       "wrap",
          gap:            "var(--space-4)",
        }}
      >
        <div>
          <h1 style={{ marginBottom: "var(--space-1)" }}>Your Journal</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-base)" }}>
            {sessions.length > 0
              ? `${sessions.length} ${sessions.length === 1 ? "entry" : "entries"} — keep going.`
              : "A quiet space waiting for your first thought."}
          </p>
        </div>

        <GlassButton
          variant="primary"
          size="md"
          loading={creating}
          icon={<Plus size={18} />}
          onClick={handleNewEntry}
          id="new-entry-btn"
        >
          New Entry
        </GlassButton>
      </motion.div>

      {/* List */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {[1, 2, 3].map((i) => <SessionCardSkeleton key={i} />)}
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={<NotebookPen size={28} />}
          title="Your journal is empty"
          description="Start your first entry and let Gemini help you explore what's on your mind. There's no wrong way to begin."
          action={
            <GlassButton variant="primary" icon={<Plus size={16} />} onClick={handleNewEntry} loading={creating}>
              Write your first entry
            </GlassButton>
          }
        />
      ) : (
        <AnimatePresence mode="popLayout">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {sessions.map((session, i) => (
              <SessionCard
                key={session.id}
                session={session}
                index={i}
                onClick={() => navigate(`/session/${session.id}`)}
                onDelete={() => {
                  if (window.confirm("Are you sure you want to delete this journal?")) {
                    deleteSession(session.id);
                  }
                }}
              />
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}

// ── Session Card ──────────────────────────────────────────

function SessionCard({
  session,
  index,
  onClick,
  onDelete,
}: {
  session: JournalSession;
  index:   number;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.div
      // layoutId enables shared-element morph into the session view
      layoutId={`session-card-${session.id}`}
      key={session.id}
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit={{    opacity: 0, y: -10, scale: 0.97 }}
      transition={{
        delay:    index * 0.04,
        duration: 0.35,
        ease:     [0.22, 1, 0.36, 1],
      }}
    >
      <GlassCard
        sheen
        onClick={onClick}
        style={{
          padding:    "var(--space-5) var(--space-6)",
          cursor:     "pointer",
          display:    "flex",
          alignItems: "center",
          gap:        "var(--space-4)",
        }}
        whileHover={{ scale: 1.01 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        role="button"
        tabIndex={0}
        aria-label={`Open journal entry: ${session.title}`}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      >
        {/* Status indicator */}
        <div
          style={{
            width:        "10px",
            height:       "10px",
            borderRadius: "50%",
            background:   session.isComplete ? "var(--sentiment-neutral)" : "var(--accent)",
            flexShrink:   0,
            boxShadow:    session.isComplete ? "none" : `0 0 8px var(--accent-glow)`,
          }}
          aria-label={session.isComplete ? "Completed" : "In progress"}
        />

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, marginBottom: "var(--space-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {session.title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
            <Clock size={12} />
            {formatDistanceToNow(session.updatedAt, { addSuffix: true })}
            {session.messageCount > 0 && (
              <>
                <span aria-hidden>·</span>
                <span>{session.messageCount} messages</span>
              </>
            )}
          </div>
        </div>

        <GlassButton
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="Delete Journal"
          icon={<Trash2 size={16} />}
          style={{ color: "var(--danger)" }}
        />
        <ChevronRight size={18} style={{ color: "var(--text-muted)", flexShrink: 0 }} aria-hidden="true" />
      </GlassCard>
    </motion.div>
  );
}

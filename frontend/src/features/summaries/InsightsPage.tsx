// InsightsPage — summaries with semantic search (Feature A)

import React, { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Search, Sparkles, TrendingUp, TrendingDown, Minus,
  Tag, ExternalLink, Loader2
} from "lucide-react";
import { useSummaries, useSessions } from "@/lib/hooks";
import { semanticSearch, type SearchResult } from "@/lib/api";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassInput } from "@/components/ui/GlassInput";
import { GlassButton } from "@/components/ui/GlassButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { SummaryCardSkeleton } from "@/components/ui/GlassSkeleton";
import { formatDistanceToNow, format } from "date-fns";
import type { SessionSummary, SentimentLabel } from "@/lib/types";

const sentimentConfig: Record<SentimentLabel, { icon: React.ReactNode; color: string; label: string }> = {
  positive: { icon: <TrendingUp size={14} />,  color: "var(--sentiment-positive)", label: "Positive" },
  neutral:  { icon: <Minus size={14} />,        color: "var(--sentiment-neutral)",  label: "Neutral"  },
  negative: { icon: <TrendingDown size={14} />, color: "var(--sentiment-negative)", label: "Reflective" },
};

export function InsightsPage() {
  const { summaries, loading: summariesLoading, error } = useSummaries();
  const { sessions, loading: sessionsLoading }          = useSessions();
  const navigate                                        = useNavigate();

  const loading = summariesLoading || sessionsLoading;

  const [query,          setQuery]          = useState("");
  const [searchResults,  setSearchResults]  = useState<SearchResult[] | null>(null);
  const [searching,      setSearching]      = useState(false);
  const [searchError,    setSearchError]    = useState<string | null>(null);
  const [isPending, startTransition]        = useTransition();

  // Completed sessions — the source of truth for insights when no cloud summaries exist
  const completedSessions = sessions.filter((s) => s.isComplete);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) { setSearchResults(null); return; }

    setSearching(true);
    setSearchError(null);

    try {
      const results = await semanticSearch(q);
      startTransition(() => setSearchResults(results));
    } catch (err) {
      // Search failed (backend not running). Filter locally instead.
      const lower = q.toLowerCase();
      const localResults = completedSessions.filter(
        (s) => (s.title.toLowerCase().includes(lower) || (s.content ?? "").toLowerCase().includes(lower))
      );
      startTransition(() => setSearchResults(localResults.map((s) => ({
        summaryId:   s.id,
        sessionId:   s.id,
        summaryText: s.content ? s.content.replace(/<[^>]*>/g, "").slice(0, 300) : "No content.",
        keyThemes:   [],
        sentiment:   "neutral" as const,
        createdAt:   s.updatedAt.toISOString(),
        score:       1,
      }))));
      setSearchError(null);
    } finally {
      setSearching(false);
    }
  }

  function clearSearch() {
    setQuery("");
    setSearchResults(null);
    setSearchError(null);
  }

  const displayedSummaries = searchResults
    ? searchResults.map((r) => ({
        id:          r.summaryId,
        sessionId:   r.sessionId,
        summaryText: r.summaryText,
        keyThemes:   r.keyThemes,
        sentiment:   r.sentiment,
        createdAt:   new Date(r.createdAt),
        score:       r.score,
      }))
    : summaries;

  // Fall back to completed sessions when no cloud summaries exist
  const showCompletedSessions = displayedSummaries.length === 0 && completedSessions.length > 0 && !loading;

  return (
    <div
      style={{ maxWidth: "860px", margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0   }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{ marginBottom: "var(--space-8)" }}
      >
        <h1 style={{ marginBottom: "var(--space-1)" }}>Insights</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Patterns and themes from your journaling, distilled by Gemini.
        </p>
      </motion.div>

      {/* Semantic Search — Feature A */}
      <GlassCard
        style={{ padding: "var(--space-5) var(--space-6)", marginBottom: "var(--space-6)" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
          <Sparkles size={16} style={{ color: "var(--accent)" }} aria-hidden="true" />
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--accent)" }}>
            Semantic Memory Search
          </span>
        </div>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "var(--space-4)" }}>
          Ask a natural-language question to find relevant past entries.
        </p>

        <form onSubmit={handleSearch} style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <GlassInput
              id="semantic-search"
              placeholder='Try "burnt out" or "my biggest goals"'
              icon={<Search size={16} />}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Semantic memory search"
            />
          </div>
          <GlassButton
            type="submit"
            variant="primary"
            loading={searching}
            icon={<Search size={16} />}
            disabled={!query.trim()}
          >
            Search
          </GlassButton>
          {searchResults !== null && (
            <GlassButton variant="ghost" onClick={clearSearch}>
              Clear
            </GlassButton>
          )}
        </form>

        {searchError && (
          <p style={{ color: "var(--danger)", fontSize: "var(--text-sm)", marginTop: "var(--space-3)" }} role="alert">
            {searchError}
          </p>
        )}

        {searchResults !== null && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginTop: "var(--space-3)" }}
          >
            {searchResults.length === 0
              ? "No matching entries found. Try rephrasing your question."
              : `${searchResults.length} relevant ${searchResults.length === 1 ? "entry" : "entries"} found.`}
          </motion.p>
        )}
      </GlassCard>

      {/* Error */}
      {error && (
        <p style={{ color: "var(--danger)", marginBottom: "var(--space-4)" }} role="alert">{error}</p>
      )}

      {/* Summary list */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {[1, 2, 3].map((i) => <SummaryCardSkeleton key={i} />)}
        </div>
      ) : displayedSummaries.length > 0 ? (
        <AnimatePresence mode="popLayout">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {displayedSummaries.map((summary, i) => (
              <SummaryCard
                key={summary.id}
                summary={summary as SessionSummary & { score?: number }}
                index={i}
                onViewSession={() => navigate(`/session/${summary.sessionId}`)}
              />
            ))}
          </div>
        </AnimatePresence>
      ) : showCompletedSessions ? (
        /* Show completed sessions directly from Firestore when backend summaries aren't available */
        <AnimatePresence mode="popLayout">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {completedSessions.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0  }}
                exit={{    opacity: 0, y: -10 }}
                transition={{ delay: i * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <GlassCard sheen style={{ padding: "var(--space-6)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "var(--space-3)", gap: "var(--space-4)" }}>
                    <div>
                      <p style={{ fontWeight: 600, marginBottom: "var(--space-1)" }}>{s.title}</p>
                      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                        Completed · {formatDistanceToNow(s.updatedAt, { addSuffix: true })}
                      </p>
                    </div>
                    <GlassButton
                      variant="ghost"
                      size="sm"
                      icon={<ExternalLink size={14} />}
                      onClick={() => navigate(`/session/${s.id}`)}
                    >
                      View entry
                    </GlassButton>
                  </div>
                  {s.content && (
                    <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: "var(--leading-relaxed)" }}>
                      {s.content.replace(/<[^>]*>/g, "").slice(0, 280)}{s.content.length > 280 ? "…" : ""}
                    </p>
                  )}
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      ) : (
        <EmptyState
          icon={<Sparkles size={28} />}
          title={searchResults !== null ? "No matches found" : "No insights yet"}
          description={
            searchResults !== null
              ? "Try a different question."
              : "Complete a journaling session to see it here."
          }
        />
      )}
    </div>
  );
}

// ── Summary Card ──────────────────────────────────────────

function SummaryCard({
  summary,
  index,
  onViewSession,
}: {
  summary:      SessionSummary & { score?: number };
  index:        number;
  onViewSession: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const sentiment = sentimentConfig[summary.sentiment];

  return (
    <motion.div
      key={summary.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0  }}
      exit={{    opacity: 0, y: -10 }}
      transition={{ delay: index * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <GlassCard sheen style={{ padding: "var(--space-6)" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "var(--space-4)", gap: "var(--space-4)" }}>
          <div>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginBottom: "var(--space-1)" }}>
              {format(summary.createdAt, "MMMM d, yyyy")} ·{" "}
              {formatDistanceToNow(summary.createdAt, { addSuffix: true })}
              {summary.score !== undefined && (
                <span style={{ marginLeft: "var(--space-2)", color: "var(--accent)", fontWeight: 600 }}>
                  {Math.round(summary.score * 100)}% match
                </span>
              )}
            </p>
            {/* Sentiment badge */}
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", color: sentiment.color }}>
              {sentiment.icon}
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{sentiment.label}</span>
            </div>
          </div>

          <GlassButton
            variant="ghost"
            size="sm"
            icon={<ExternalLink size={14} />}
            onClick={onViewSession}
            aria-label="View original journal entry"
          >
            View entry
          </GlassButton>
        </div>

        {/* Summary text */}
        <div
          style={{
            fontSize:   "var(--text-base)",
            lineHeight: "var(--leading-relaxed)",
            color:      "var(--text-secondary)",
            marginBottom: "var(--space-4)",
          }}
        >
          {expanded ? (
            <p>{summary.summaryText}</p>
          ) : (
            <p className="line-clamp-3">{summary.summaryText}</p>
          )}
          {summary.summaryText.length > 200 && (
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                background:  "none",
                border:      "none",
                color:       "var(--accent)",
                cursor:      "pointer",
                fontSize:    "var(--text-sm)",
                padding:     "var(--space-1) 0",
                fontWeight:  600,
              }}
              aria-expanded={expanded}
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>

        {/* Key themes */}
        {summary.keyThemes.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
            {summary.keyThemes.map((theme) => (
              <span
                key={theme}
                style={{
                  display:      "inline-flex",
                  alignItems:   "center",
                  gap:          "var(--space-1)",
                  padding:      "var(--space-1) var(--space-3)",
                  borderRadius: "var(--radius-full)",
                  background:   "var(--accent-subtle)",
                  border:       "1px solid color-mix(in oklch, var(--accent) 30%, transparent)",
                  color:        "var(--accent)",
                  fontSize:     "var(--text-sm)",
                  fontWeight:   500,
                }}
              >
                <Tag size={11} aria-hidden="true" />
                {theme}
              </span>
            ))}
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}

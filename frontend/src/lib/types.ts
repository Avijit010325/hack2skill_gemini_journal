// Shared TypeScript types for the Personal Gemini Journal
// These mirror the Firestore data model defined in the security rules.

export interface UserProfile {
  uid:         string;
  displayName: string | null;
  photoURL:    string | null;
  email:       string | null;
  createdAt:   Date;
}

export interface JournalSession {
  id:         string;
  title:      string;
  content?:   string;
  startedAt:  Date;
  updatedAt:  Date;
  mood?:      string;
  tags?:      string[];
  isComplete: boolean;
  messageCount: number;
}

export interface JournalMessage {
  id:        string;
  sessionId: string;
  role:      "user" | "model";
  content:   string;
  createdAt: Date;
}

export interface SessionSummary {
  id:          string;
  sessionId:   string;
  summaryText: string;
  keyThemes:   string[];
  sentiment:   "positive" | "neutral" | "negative";
  createdAt:   Date;
  // Feature A: embedding stored alongside (written by backend)
  embedding?:  number[];
}

export type SentimentLabel = "positive" | "neutral" | "negative";

// Cloud Functions v2 — main entry point
// All routes require a verified Firebase ID token (via requireAuth middleware).
// The Gemini API key is retrieved from Secret Manager, never from client input.

import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import express from "express";
import cors from "cors";
import { z } from "zod";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import {
  getFirestore,
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";

import { requireAuth } from "./auth.middleware";
import { rateLimit } from "./rate-limit.middleware";
import { getGeminiApiKeyWithDevFallback } from "./secrets";

// ── Firebase Admin init ───────────────────────────────────

admin.initializeApp();
const db = getFirestore();

// ── Gemini client (lazy-initialized at first request) ─────

let _genAI: GoogleGenerativeAI | null = null;

async function getGenAI(): Promise<GoogleGenerativeAI> {
  if (_genAI) return _genAI;
  const apiKey = await getGeminiApiKeyWithDevFallback();
  _genAI = new GoogleGenerativeAI(apiKey);
  return _genAI;
}

// Safety settings — applied to all Gemini calls
const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// System instruction for the journaling assistant
const JOURNAL_SYSTEM_INSTRUCTION = `You are a thoughtful, empathetic journaling companion. 
Your role is to help the user explore their thoughts, feelings, and experiences through reflective conversation.
Ask open-ended questions, offer gentle observations, and help surface patterns and insights.
Be warm but not saccharine, curious but not intrusive. 
Never give direct medical or psychological advice. Never judge or shame.
Keep responses concise (2-4 sentences) unless the user asks for more depth.`;

// ── Express app ───────────────────────────────────────────

const app = express();

// C-1 FIX: Explicit CORS allowlist — never reflect arbitrary origins.
// Fail closed: if FRONTEND_URL is not set, no origin is allowed (CORS rejected).
// In local dev, set FRONTEND_URL=http://localhost:5173 in functions/.env
const ALLOWED_ORIGINS = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((o) => o.trim()).filter(Boolean)
  : [];

if (ALLOWED_ORIGINS.length === 0) {
  console.warn("[cors] FRONTEND_URL not set — all cross-origin requests will be rejected. Set FRONTEND_URL in environment.");
}

app.use(cors({
  origin: (requestOrigin, callback) => {
    // Allow server-to-server calls (no Origin header)
    if (!requestOrigin) return callback(null, true);
    // Strict allowlist check — no wildcards, no reflection
    if (ALLOWED_ORIGINS.includes(requestOrigin)) {
      return callback(null, true);
    }
    console.warn("[cors] Rejected request from disallowed origin.", { requestOrigin });
    return callback(new Error("CORS: origin not allowed"));
  },
  methods: ["POST"],
  allowedHeaders: ["Authorization", "Content-Type"],
}));

app.use(express.json({ limit: "16kb" })); // limit request body size

// Apply auth + rate limit to all API routes
app.use(requireAuth as express.RequestHandler);
app.use(rateLimit   as express.RequestHandler);

// ── POST /chat ────────────────────────────────────────────
// Verifies token → loads session history from Firestore → streams Gemini response
// → persists both turns to Firestore.

const chatSchema = z.object({
  sessionId: z.string().min(1).max(128),
  message:   z.string().min(1).max(8000).trim(),
});

app.post("/chat", async (req, res) => {
  const uid = req.uid!;

  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: "invalid-input", message: "Invalid request body." });
    return;
  }

  const { sessionId, message } = parsed.data;

  // Verify session belongs to this user (data isolation)
  const sessionRef = db.doc(`users/${uid}/sessions/${sessionId}`);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) {
    res.status(404).json({ code: "not-found", message: "Session not found." });
    return;
  }

  // H-2 FIX: Reject writes to completed sessions — prevents history corruption
  // after /summarize and /embed have already been called.
  if (sessionSnap.data()?.isComplete === true) {
    res.status(409).json({ code: "session-complete", message: "This session is complete. Please start a new session to continue journaling." });
    return;
  }

  // Load prior messages server-side — client never sees another user's messages
  const messagesSnap = await db
    .collection(`users/${uid}/sessions/${sessionId}/messages`)
    .orderBy("createdAt", "asc")
    .limit(50) // cap context window
    .get();

  const history = messagesSnap.docs.map((d) => ({
    role:  d.data().role === "user" ? "user" : "model",
    parts: [{ text: d.data().content as string }],
  }));

  // Stream SSE
  res.setHeader("Content-Type",      "text/event-stream");
  res.setHeader("Cache-Control",     "no-cache");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    const genAI = await getGenAI();
    const model = genAI.getGenerativeModel({
      model:             "gemini-2.0-flash",
      safetySettings:    SAFETY_SETTINGS,
      systemInstruction: JOURNAL_SYSTEM_INSTRUCTION,
    });

    const chat         = model.startChat({ history });
    const streamResult = await chat.sendMessageStream(message);

    let fullModelResponse = "";

    for await (const chunk of streamResult.stream) {
      const text = chunk.text();
      if (text) {
        fullModelResponse += text;
        res.write(`data: ${JSON.stringify({ chunk: text })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();

    // Persist both turns to Firestore (server-side write)
    const now = FieldValue.serverTimestamp();
    const messagesRef = db.collection(`users/${uid}/sessions/${sessionId}/messages`);

    const batch = db.batch();
    batch.set(messagesRef.doc(), { role: "user",  content: message,             createdAt: now });
    batch.set(messagesRef.doc(), { role: "model", content: fullModelResponse,   createdAt: now });
    batch.update(sessionRef, {
      updatedAt:    now,
      messageCount: FieldValue.increment(2),
      // L-1 FIX: Strip control characters from title (\n, \r, \0 etc.)
      ...(messagesSnap.empty ? { title: message.slice(0, 60).replace(/[\x00-\x1F\x7F]/g, " ").trim() } : {}),
    });
    await batch.commit();

  } catch (err) {
    console.error("[/chat] Gemini streaming error:", (err as Error).message);
    res.write(`data: ${JSON.stringify({ error: "AI response failed. Please try again." })}\n\n`);
    res.end();
  }
});

// ── POST /summarize ───────────────────────────────────────
// Generates a session summary with key themes + sentiment.
// Writes result to /users/{uid}/summaries/{summaryId}.

const summarizeSchema = z.object({
  sessionId: z.string().min(1).max(128),
});

app.post("/summarize", async (req, res) => {
  const uid = req.uid!;

  const parsed = summarizeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: "invalid-input", message: "Invalid request body." });
    return;
  }

  const { sessionId } = parsed.data;

  // Verify ownership
  const sessionSnap = await db.doc(`users/${uid}/sessions/${sessionId}`).get();
  if (!sessionSnap.exists) {
    res.status(404).json({ code: "not-found", message: "Session not found." });
    return;
  }

  // Load transcript
  const messagesSnap = await db
    .collection(`users/${uid}/sessions/${sessionId}/messages`)
    .orderBy("createdAt", "asc")
    .get();

  if (messagesSnap.empty) {
    res.status(400).json({ code: "empty-session", message: "No messages to summarize." });
    return;
  }

  const transcript = messagesSnap.docs
    .map((d) => `${d.data().role === "user" ? "User" : "Gemini"}: ${d.data().content}`)
    .join("\n");

  const summaryPrompt = `
You are analyzing a personal journal conversation. Provide a JSON response with:
- "summaryText": A warm, insightful 3-5 sentence summary of what the person explored.
- "keyThemes": An array of 2-5 short theme labels (e.g. "work-life balance", "gratitude").
- "sentiment": One of "positive", "neutral", or "negative" — reflecting the overall emotional tone.

Respond ONLY with valid JSON. No markdown, no explanation.

Conversation:
${transcript.slice(0, 12000)}
`;

  // C-2 FIX: Validate LLM response with Zod — never trust raw model output.
  // Prevents type confusion, prototype pollution, and field injection.
  const llmResponseSchema = z.object({
    summaryText: z.string().min(1).max(2000).trim(),
    keyThemes:   z.array(z.string().min(1).max(50).trim()).min(0).max(10),
    sentiment:   z.enum(["positive", "neutral", "negative"]),
  }).strict(); // .strict() rejects any extra keys (prevents prototype pollution)

  try {
    const genAI = await getGenAI();
    const model = genAI.getGenerativeModel({
      model:          "gemini-2.0-flash",
      safetySettings: SAFETY_SETTINGS,
    });

    const result   = await model.generateContent(summaryPrompt);
    const rawText  = result.response.text().trim();

    // Strip markdown fences if present
    const jsonText = rawText.replace(/^```json\n?/, "").replace(/\n?```$/, "");

    let rawParsed: unknown;
    try {
      rawParsed = JSON.parse(jsonText);
    } catch {
      console.error("[/summarize] LLM returned invalid JSON");
      res.status(500).json({ code: "internal", message: "Summarization failed. Please try again." });
      return;
    }

    // Validate structure and types — reject unknown keys, enforce enum
    const validated = llmResponseSchema.safeParse(rawParsed);
    if (!validated.success) {
      console.error("[/summarize] LLM response failed schema validation.", validated.error.issues);
      res.status(500).json({ code: "internal", message: "Summarization failed. Please try again." });
      return;
    }

    const summary = validated.data;

    // Write summary (backend-only write — Firestore rules deny client writes)
    const summaryRef = db.collection(`users/${uid}/summaries`).doc();
    await summaryRef.set({
      sessionId,
      summaryText: summary.summaryText,
      keyThemes:   summary.keyThemes,
      sentiment:   summary.sentiment,
      createdAt:   FieldValue.serverTimestamp(),
    });

    res.json({ summaryId: summaryRef.id });

  } catch (err) {
    console.error("[/summarize] Error:", (err as Error).message);
    res.status(500).json({ code: "internal", message: "Summarization failed. Please try again." });
  }
});

// ── POST /embed — Feature A: semantic embedding ───────────

const embedSchema = z.object({
  summaryId: z.string().min(1).max(128),
});

app.post("/embed", async (req, res) => {
  const uid = req.uid!;

  const parsed = embedSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: "invalid-input", message: "Invalid request body." });
    return;
  }

  const { summaryId } = parsed.data;

  // Verify the summary belongs to this user
  const summaryRef  = db.doc(`users/${uid}/summaries/${summaryId}`);
  const summarySnap = await summaryRef.get();
  if (!summarySnap.exists) {
    res.status(404).json({ code: "not-found", message: "Summary not found." });
    return;
  }

  const summaryText = summarySnap.data()!.summaryText as string;

  try {
    const genAI  = await getGenAI();
    const model  = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(summaryText);
    const vector = result.embedding.values;

    // Store embedding in the summary document (backend-only write)
    await summaryRef.update({ embedding: vector });

    res.json({ ok: true });
  } catch (err) {
    console.error("[/embed] Error:", (err as Error).message);
    res.status(500).json({ code: "internal", message: "Embedding generation failed." });
  }
});

// ── POST /search — Feature A: semantic search ─────────────

const searchSchema = z.object({
  query: z.string().min(1).max(500).trim(),
});

app.post("/search", async (req, res) => {
  const uid = req.uid!;

  const parsed = searchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: "invalid-input", message: "Invalid query." });
    return;
  }

  const { query } = parsed.data;

  try {
    // Generate embedding for the search query
    const genAI       = await getGenAI();
    const embedModel  = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const queryResult = await embedModel.embedContent(query);
    const queryVector = queryResult.embedding.values;

    // Load ALL of this user's summaries that have embeddings
    // This is scoped strictly to uid — no cross-user data access
    const summariesSnap = await db
      .collection(`users/${uid}/summaries`)
      .where("embedding", "!=", null)
      .orderBy("embedding") // required for inequality filter
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    if (summariesSnap.empty) {
      res.json([]);
      return;
    }

    // Compute cosine similarity client-side (on the backend)
    const results = summariesSnap.docs
      .map((d) => {
        const data      = d.data();
        const embedding = data.embedding as number[] | undefined;
        if (!embedding) return null;

        const score = cosineSimilarity(queryVector, embedding);
        return {
          summaryId:   d.id,
          sessionId:   data.sessionId as string,
          summaryText: data.summaryText as string,
          keyThemes:   data.keyThemes  as string[],
          sentiment:   data.sentiment  as string,
          createdAt:   (data.createdAt as Timestamp).toDate().toISOString(),
          score,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .filter((r) => r.score > 0.65) // threshold for relevance
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    res.json(results);

  } catch (err) {
    console.error("[/search] Error:", (err as Error).message);
    res.status(500).json({ code: "internal", message: "Search failed. Please try again." });
  }
});

// ── Cosine similarity helper ──────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ── Export as Cloud Function ──────────────────────────────

export const api = onRequest(
  {
    region:       "us-central1",
    memory:       "512MiB",
    timeoutSeconds: 120,
    // Secret Manager access via attached service account
    // (no explicit secret config needed — runtime SA has IAM access)
  },
  app,
);

import { auth, db } from "./firebase";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { collection, doc, getDoc, getDocs, orderBy, query, limit, addDoc, updateDoc, serverTimestamp, increment } from "firebase/firestore";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

let _genAI: GoogleGenerativeAI | null = null;
function getGenAI() {
  if (_genAI) return _genAI;
  if (!GEMINI_API_KEY) throw new Error("Gemini API key is not configured.");
  _genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  return _genAI;
}

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

const JOURNAL_SYSTEM_INSTRUCTION = `You are a thoughtful, empathetic journaling companion. 
Your role is to help the user explore their thoughts, feelings, and experiences through reflective conversation.
Ask open-ended questions, offer gentle observations, and help surface patterns and insights.
Be warm but not saccharine, curious but not intrusive. 
Never give direct medical or psychological advice. Never judge or shame.
Keep responses concise (2-4 sentences) unless the user asks for more depth.`;

export interface ChatMessage {
  role: "user" | "model";
  content: string;
}

export async function streamChat(
  sessionId: string,
  message: string,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (err: Error) => void,
): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) throw new ApiError(401, "Not authenticated");

    const sessionRef = doc(db, "users", user.uid, "sessions", sessionId);
    const sessionSnap = await getDoc(sessionRef);
    if (!sessionSnap.exists()) throw new ApiError(404, "Session not found.");
    if (sessionSnap.data()?.isComplete) throw new ApiError(409, "This session is complete.");

    const messagesSnap = await getDocs(query(collection(db, "users", user.uid, "sessions", sessionId, "messages"), orderBy("createdAt", "asc"), limit(50)));
    const history = messagesSnap.docs.map((d) => ({
      role: d.data().role === "user" ? "user" : "model",
      parts: [{ text: d.data().content as string }],
    }));

    const model = getGenAI().getGenerativeModel({ model: "gemini-3.5-flash", safetySettings: SAFETY_SETTINGS, systemInstruction: JOURNAL_SYSTEM_INSTRUCTION });
    const chat = model.startChat({ history });
    
    const messagesRef = collection(db, "users", user.uid, "sessions", sessionId, "messages");
    await addDoc(messagesRef, { role: "user", content: message, createdAt: serverTimestamp() });

    const streamResult = await chat.sendMessageStream(message);
    let fullModelResponse = "";

    for await (const chunk of streamResult.stream) {
      const text = chunk.text();
      if (text) {
        fullModelResponse += text;
        onChunk(text);
      }
    }

    await addDoc(messagesRef, { role: "model", content: fullModelResponse, createdAt: serverTimestamp() });
    await updateDoc(sessionRef, {
      updatedAt: serverTimestamp(),
      messageCount: increment(2),
      ...(messagesSnap.empty ? { title: message.slice(0, 60).replace(/[\x00-\x1F\x7F]/g, " ").trim() } : {}),
    });

    onDone();
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

export interface SummarizeResponse {
  summaryId: string;
}

export async function summarizeSession(sessionId: string): Promise<SummarizeResponse> {
  const user = auth.currentUser;
  if (!user) throw new ApiError(401, "Not authenticated");

  const sessionSnap = await getDoc(doc(db, "users", user.uid, "sessions", sessionId));
  if (!sessionSnap.exists()) throw new ApiError(404, "Session not found.");

  const content = sessionSnap.data().content || "";

  let transcript = content.replace(/<[^>]+>/g, '\n'); 
  
  if (!transcript.trim()) {
      const messagesSnap = await getDocs(query(collection(db, "users", user.uid, "sessions", sessionId, "messages"), orderBy("createdAt", "asc")));
      transcript = messagesSnap.docs.map((d) => `${d.data().role === "user" ? "User" : "Gemini"}: ${d.data().content}`).join("\n");
  }

  if (!transcript.trim()) throw new Error("No content to summarize.");

  const summaryPrompt = `
You are analyzing a personal journal conversation or entry. Provide a JSON response with:
- "summaryText": A warm, insightful 3-5 sentence summary of what the person explored.
- "keyThemes": An array of 2-5 short theme labels (e.g. "work-life balance", "gratitude").
- "sentiment": One of "positive", "neutral", or "negative" — reflecting the overall emotional tone.

Respond ONLY with valid JSON. No markdown, no explanation.

Conversation/Entry:
${transcript.slice(0, 12000)}
`;

  const model = getGenAI().getGenerativeModel({ model: "gemini-3.5-flash", safetySettings: SAFETY_SETTINGS });
  const result = await model.generateContent(summaryPrompt);
  const rawText = result.response.text().trim();
  const jsonText = rawText.replace(/^```json\n?/, "").replace(/\n?```$/, "");

  let summary;
  try {
    summary = JSON.parse(jsonText);
  } catch (e) {
    console.error("Failed to parse Gemini summary JSON", jsonText);
    throw new Error("Invalid format from Gemini");
  }

  const summaryRef = collection(db, "users", user.uid, "summaries");
  const docRef = await addDoc(summaryRef, {
    sessionId,
    summaryText: summary.summaryText,
    keyThemes: summary.keyThemes,
    sentiment: summary.sentiment,
    createdAt: serverTimestamp(),
  });
  
  return { summaryId: docRef.id };
}

export interface SearchResult {
  summaryId: string;
  sessionId: string;
  summaryText: string;
  keyThemes: string[];
  sentiment: "positive" | "neutral" | "negative";
  createdAt: string;
  score: number;
}

export async function semanticSearch(queryStr: string): Promise<SearchResult[]> {
  const user = auth.currentUser;
  if (!user) throw new ApiError(401, "Not authenticated");

  const summariesSnap = await getDocs(query(collection(db, "users", user.uid, "summaries"), limit(50)));
  if (summariesSnap.empty) return [];

  const summaries = summariesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  const searchPrompt = `
You are a semantic search engine. The user searched for: "${queryStr}".
I will provide a list of journal summaries as JSON. 
Return a JSON array of the IDs of the summaries that match the search query conceptually or literally, ranked by relevance (most relevant first).
Only return the IDs in a JSON array of strings, like ["id1", "id2"]. No markdown.

Summaries:
${JSON.stringify(summaries)}
`;

  const model = getGenAI().getGenerativeModel({ model: "gemini-3.5-flash", safetySettings: SAFETY_SETTINGS });
  const result = await model.generateContent(searchPrompt);
  const rawText = result.response.text().trim();
  const jsonText = rawText.replace(/^```json\n?/, "").replace(/\n?```$/, "");
  
  let matchedIds: string[] = [];
  try {
    matchedIds = JSON.parse(jsonText);
  } catch(e) {
    console.error("Failed to parse search JSON");
  }
  
  const matchedSummaries = summaries
    .filter(s => matchedIds.includes(s.id))
    .sort((a, b) => matchedIds.indexOf(a.id) - matchedIds.indexOf(b.id))
    .map((s, i) => ({
      summaryId: s.id,
      sessionId: s.sessionId as string,
      summaryText: s.summaryText as string,
      keyThemes: (s.keyThemes || []) as string[],
      sentiment: s.sentiment as any,
      createdAt: s.createdAt?.toString() || "",
      score: 1 - (i * 0.1)
    }));

  return matchedSummaries;
}

export { ApiError };

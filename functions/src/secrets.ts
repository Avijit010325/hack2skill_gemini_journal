// Secret Manager integration
// Fetches the Gemini API key at cold start from Google Cloud Secret Manager.
// The key is cached in module scope — never logged, never sent to the client.
//
// Security: this module runs only in the Cloud Functions runtime, where
// the attached service account has Secret Manager Secret Accessor IAM role.
// No service account JSON key is used or checked into source control.

import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

const client = new SecretManagerServiceClient();

// Cached key — fetched once per cold start, never re-fetched on warm invocations
let _geminiApiKey: string | null = null;

/**
 * Retrieve the Gemini API key from Secret Manager.
 * Uses the latest version of the secret named "gemini-api-key".
 * Caches the result in module scope for subsequent warm invocations.
 */
export async function getGeminiApiKey(): Promise<string> {
  if (_geminiApiKey) return _geminiApiKey;

  const projectId = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) {
    throw new Error("GCLOUD_PROJECT env var not set — cannot resolve Secret Manager path.");
  }

  const name = `projects/${projectId}/secrets/gemini-api-key/versions/latest`;

  const [version] = await client.accessSecretVersion({ name });
  const payload   = version.payload?.data;

  if (!payload) {
    throw new Error("Secret Manager returned empty payload for gemini-api-key.");
  }

  const key = typeof payload === "string" ? payload : Buffer.from(payload).toString("utf8");

  if (!key || key.length < 10) {
    throw new Error("Retrieved Gemini API key appears invalid (too short).");
  }

  // Cache — never log the key value itself
  _geminiApiKey = key;
  console.info("[secrets] Gemini API key loaded from Secret Manager.");

  return _geminiApiKey;
}

// For local emulator development: fall back to env var if Secret Manager is unavailable
// This fallback is explicitly gated to dev-only to prevent accidental use in prod.
export async function getGeminiApiKeyWithDevFallback(): Promise<string> {
  if (process.env.NODE_ENV !== "production" && process.env.GEMINI_API_KEY_DEV) {
    console.warn("[secrets] DEV MODE: using GEMINI_API_KEY_DEV env var — not Secret Manager.");
    return process.env.GEMINI_API_KEY_DEV;
  }
  return getGeminiApiKey();
}

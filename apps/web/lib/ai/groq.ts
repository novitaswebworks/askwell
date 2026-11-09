import "server-only";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, streamText } from "ai";
import { requireEnv } from "@/lib/supabase/env";
import { AiUnavailableError } from "./errors";
import type { Generation } from "@/lib/analytics";

// Chat runs on Groq: fast enough for a visitor waiting on a reply. Embeddings
// stay on our own Ollama server (see ollama.ts).
// Groq's Llama models are not open to every account (this key's /models list has
// none), so the default is an open-weights model every key can use. The 20B model
// answered in about a second every time; the 120B one often timed out on this key.
export const DEFAULT_CHAT_MODEL = "openai/gpt-oss-20b";
// Groq limits tokens per minute per model (8,000 on this key). When one model is
// throttled or down, the next one has its own allowance, so replies keep flowing.
export const DEFAULT_FALLBACK_MODELS = ["qwen/qwen3.8-27b", "openai/gpt-oss-120b"];
const CHAT_TIMEOUT_MS = 30_000;
const MIN_ATTEMPT_MS = 3_000;
// With a backup endpoint set, Groq gets this share of the time and the rest is kept for the backup.
const GROQ_SHARE_WITH_BACKUP = 0.5;

type Env = Record<string, string | undefined>;

export interface BackupProvider {
  baseURL: string;
  apiKey: string;
  model: string;
}

// An optional OpenAI-compatible endpoint (for example a self-hosted gateway) tried
// only after every Groq model has failed. Off unless all three variables are set.
export function backupProvider(env: Env = process.env): BackupProvider | null {
  const baseURL = env.BACKUP_LLM_BASE_URL?.trim().replace(/\/$/, "");
  const apiKey = env.BACKUP_LLM_API_KEY?.trim();
  const model = env.BACKUP_LLM_MODEL?.trim();
  if (!baseURL || !apiKey || !model) return null;
  if (!/^https:\/\//.test(baseURL)) return null;
  return { baseURL, apiKey, model };
}

export function chatModelName(env: Env = process.env): string {
  return env.GROQ_CHAT_MODEL?.trim() || DEFAULT_CHAT_MODEL;
}

// The primary model first, then the fallbacks (GROQ_FALLBACK_MODELS, comma
// separated, or the defaults), without repeats.
export function chatModelNames(env: Env = process.env): string[] {
  const primary = chatModelName(env);
  const fallbacks =
    env.GROQ_FALLBACK_MODELS === undefined
      ? DEFAULT_FALLBACK_MODELS
      : env.GROQ_FALLBACK_MODELS.split(",").map((m) => m.trim()).filter(Boolean);
  return [primary, ...fallbacks.filter((m) => m !== primary)];
}

export async function generateAnswer(
  system: string,
  prompt: string,
  options: { maxOutputTokens?: number; timeoutMs?: number; onGeneration?: (g: Generation) => void } = {},
): Promise<string> {
  let lastError: unknown;
  const backup = backupProvider();
  const startedAll = Date.now();
  const totalMs = options.timeoutMs ?? CHAT_TIMEOUT_MS;
  try {
    const groq = createOpenAICompatible({
      name: "groq",
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: requireEnv("GROQ_API_KEY", process.env.GROQ_API_KEY),
    });
    const models = chatModelNames();
    const deadline = startedAll + (backup ? totalMs * GROQ_SHARE_WITH_BACKUP : totalMs);

    for (const [index, name] of models.entries()) {
      const remaining = deadline - Date.now();
      if (remaining < 500) break;
      // A whole number of milliseconds: AbortSignal.timeout rejects fractions.
      const attemptMs = Math.floor(Math.max(MIN_ATTEMPT_MS, remaining / (models.length - index)));
      const startedAt = Date.now();
      try {
        const { text, usage } = await generateText({
          model: groq.chatModel(name),
          system,
          prompt,
          temperature: 0.2,
          // gpt-oss models think before they answer; low effort keeps replies fast,
          // and the output budget leaves room for the reasoning tokens.
          ...(name.startsWith("openai/gpt-oss") ? { providerOptions: { groq: { reasoningEffort: "low" } } } : {}),
          maxOutputTokens: options.maxOutputTokens ?? 800,
          abortSignal: AbortSignal.timeout(Math.min(attemptMs, Math.floor(remaining))),
          maxRetries: 0, // a throttled model is skipped, not waited on
        });
        options.onGeneration?.({
          model: name,
          inputTokens: usage?.inputTokens,
          outputTokens: usage?.outputTokens,
          latencyMs: Date.now() - startedAt,
        });
        return text.trim();
      } catch (error) {
        lastError = error;
        console.error(`[groq] ${name} failed:`, error instanceof Error ? error.message : error);
      }
    }
  } catch (error) {
    lastError = error;
  }

  if (backup) {
    const remaining = Math.floor(startedAll + totalMs - Date.now());
    if (remaining >= 500) {
      const startedAt = Date.now();
      try {
        const provider = createOpenAICompatible({ name: "backup", baseURL: backup.baseURL, apiKey: backup.apiKey });
        const { text, usage } = await generateText({
          model: provider.chatModel(backup.model),
          system,
          prompt,
          temperature: 0.2,
          maxOutputTokens: options.maxOutputTokens ?? 800,
          abortSignal: AbortSignal.timeout(remaining),
          maxRetries: 0,
        });
        options.onGeneration?.({
          model: `backup:${backup.model}`,
          inputTokens: usage?.inputTokens,
          outputTokens: usage?.outputTokens,
          latencyMs: Date.now() - startedAt,
        });
        return text.trim();
      } catch (error) {
        lastError = error;
        console.error(`[backup] ${backup.model} failed:`, error instanceof Error ? error.message : error);
      }
    }
  }
  throw new AiUnavailableError(lastError ?? new Error("no time left"));
}


// Like generateAnswer, but yields the reply as it is written. A model that fails before its
// first word is skipped for the next one, as in generateAnswer; once words have gone out a
// failure ends the stream with an error, because a half-shown reply cannot be taken back.
// shortcut: the model list and time sharing mirror generateAnswer; merge them if a third caller needs it.
export async function* streamAnswer(
  system: string,
  prompt: string,
  options: { maxOutputTokens?: number; timeoutMs?: number; onGeneration?: (g: Generation) => void } = {},
): AsyncGenerator<string> {
  const startedAll = Date.now();
  const totalMs = options.timeoutMs ?? CHAT_TIMEOUT_MS;
  const backup = backupProvider();
  // Like generateAnswer, a missing Groq key is not fatal when a backup is set: the backup is tried.
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const groq = groqKey ? createOpenAICompatible({ name: "groq", baseURL: "https://api.groq.com/openai/v1", apiKey: groqKey }) : null;
  const candidates = [
    ...(groq ? chatModelNames().map((name) => ({ name, model: groq.chatModel(name), gptOss: name.startsWith("openai/gpt-oss"), isBackup: false })) : []),
    ...(backup
      ? [{ name: `backup:${backup.model}`, model: createOpenAICompatible({ name: "backup", baseURL: backup.baseURL, apiKey: backup.apiKey }).chatModel(backup.model), gptOss: false, isBackup: true }]
      : []),
  ];
  // With a backup, Groq's models share part of the time and the backup keeps the rest, as in generateAnswer.
  const groqDeadline = startedAll + (backup ? totalMs * GROQ_SHARE_WITH_BACKUP : totalMs);
  const groqCount = candidates.filter((c) => !c.isBackup).length;

  let lastError: unknown;
  for (const [index, c] of candidates.entries()) {
    const remaining = (c.isBackup ? startedAll + totalMs : groqDeadline) - Date.now();
    if (remaining < 500) {
      if (c.isBackup) break;
      continue; // Groq's share is used up; the backup may still have its time
    }
    const attemptMs = c.isBackup ? remaining : Math.floor(Math.max(MIN_ATTEMPT_MS, remaining / (groqCount - index)));
    const startedAt = Date.now();
    let spoke = false;
    try {
      const result = streamText({
        model: c.model,
        system,
        prompt,
        temperature: 0.2,
        ...(c.gptOss ? { providerOptions: { groq: { reasoningEffort: "low" } } } : {}),
        maxOutputTokens: options.maxOutputTokens ?? 800,
        abortSignal: AbortSignal.timeout(Math.min(attemptMs, Math.floor(remaining))),
        maxRetries: 0,
      });
      for await (const part of result.fullStream) {
        if (part.type === "error") throw part.error instanceof Error ? part.error : new Error(String(part.error));
        if (part.type === "text-delta" && part.text) {
          spoke = true;
          yield part.text;
        }
      }
      if (!spoke) throw new Error("empty reply");
      const usage = await result.usage;
      options.onGeneration?.({
        model: c.name,
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
        latencyMs: Date.now() - startedAt,
      });
      return;
    } catch (error) {
      lastError = error;
      console.error(`[stream] ${c.name} failed:`, error instanceof Error ? error.message : error);
      if (spoke) throw new AiUnavailableError(error);
    }
  }
  throw new AiUnavailableError(lastError ?? new Error("no time left"));
}

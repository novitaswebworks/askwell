import "server-only";
import { buildUnderstandPrompt, parseUnderstanding, UNDERSTAND_SYSTEM, type Turn, type Understanding } from "@/lib/understand";
import { generateAnswer } from "./groq";

// Never throws: if the model is slow or answers badly, the message is treated as
// a plain question about what the visitor wrote, and the normal flow continues.
export async function understandMessage(about: string, history: Turn[], message: string): Promise<Understanding> {
  try {
    const raw = await generateAnswer(UNDERSTAND_SYSTEM, buildUnderstandPrompt(about, history, message), {
      maxOutputTokens: 300,
      timeoutMs: 12_000,
    });
    return parseUnderstanding(raw, message);
  } catch (error) {
    console.error("[chat] understanding failed:", error instanceof Error ? error.message : error);
    return { type: "question", standalone: message };
  }
}

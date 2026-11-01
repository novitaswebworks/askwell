import "server-only";
import { after } from "next/server";
import { PostHog } from "posthog-node";

// Product analytics, AI tracing and error tracking, sent to PostHog from the
// server. Nothing here may slow down or break a request: every call is
// fire-and-forget, flushed after the response, and wrapped so a PostHog problem
// never reaches the visitor. Prompts and replies are never sent, only counts.

const DEFAULT_HOST = "https://us.i.posthog.com";

type Env = Record<string, string | undefined>;

// The project key is public by design (it ships to browsers). Read at request time.
export function postHogConfig(env: Env = process.env): { key: string; host: string } | null {
  const key = (env.POSTHOG_KEY ?? env.NEXT_PUBLIC_POSTHOG_KEY)?.trim();
  if (!key) return null;
  const host = (env.POSTHOG_HOST ?? env.NEXT_PUBLIC_POSTHOG_HOST)?.trim() || DEFAULT_HOST;
  return { key, host: host.replace(/\/$/, "") };
}

let client: PostHog | null | undefined;

function getClient(): PostHog | null {
  if (client !== undefined) return client;
  const config = postHogConfig();
  client = config ? new PostHog(config.key, { host: config.host, flushAt: 20, flushInterval: 5000 }) : null;
  return client;
}

// Sends what is queued once the response has gone out. Outside a request there is
// no "after", so it flushes straight away.
function flushLater(ph: PostHog) {
  const flush = () => ph.flush().catch(() => {});
  try {
    after(flush);
  } catch {
    void flush();
  }
}

export interface AnalyticsEvent {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
  // Visitors of a customer's site: no person profile is created for them.
  anonymous?: boolean;
}

export function track({ distinctId, event, properties, anonymous }: AnalyticsEvent): void {
  try {
    const ph = getClient();
    if (!ph) return;
    ph.capture({
      distinctId,
      event,
      properties: { ...properties, ...(anonymous ? { $process_person_profile: false } : {}) },
    });
    flushLater(ph);
  } catch {
    // Analytics must never break a request.
  }
}

export interface Generation {
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
}

// PostHog LLM analytics: model, tokens, latency and project, never the text.
export function trackGeneration(
  g: Generation & { distinctId: string; projectId: string; traceId: string; spanName: string },
): void {
  track({
    distinctId: g.distinctId,
    event: "$ai_generation",
    anonymous: true,
    properties: {
      $ai_trace_id: g.traceId,
      $ai_span_name: g.spanName,
      $ai_provider: "groq",
      $ai_model: g.model,
      $ai_input_tokens: g.inputTokens,
      $ai_output_tokens: g.outputTokens,
      $ai_latency: g.latencyMs / 1000,
      $ai_http_status: 200,
      project_id: g.projectId,
    },
  });
}

// Next calls this for every uncaught server error.
export async function captureServerError(error: unknown, properties: Record<string, unknown> = {}): Promise<void> {
  try {
    await getClient()?.captureExceptionImmediate(error, undefined, properties);
  } catch {
    // Reporting an error must not raise another.
  }
}

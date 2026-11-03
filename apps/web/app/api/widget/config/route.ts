import { NextResponse } from "next/server";
import {
  DEFAULT_WIDGET_CONFIG,
  isHostAllowed,
  planSchema,
  widgetConfigQuerySchema,
  type WidgetConfig,
} from "@askwell/shared";
import { apiError } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/service";
import { hostFromHeaders, hostFromOriginParam, recordSeen, shouldRecordSeen } from "@/lib/seen";
import { applyPlanToConfig } from "@/lib/widget-config";

// Public route, called from any website. The key only identifies a project.
const CORS = { "Access-Control-Allow-Origin": "*" };
// The answer depends on which site asks, so shared caches must keep them apart.
const CORS_VARY = { ...CORS, Vary: "Origin" };
// Browsers keep it for a minute. Vercel's edge keeps it for five and, for ten more minutes after that,
// serves the old copy instantly while it fetches a fresh one in the background, so a visitor rarely waits
// for the database. (Vercel only does this for s-maxage, not for max-age.) The window is kept short on
// purpose: a changed colour or text, and a domain removed from the allowed list, reach every customer's
// site within about fifteen minutes at most.
const CONFIG_CACHE_CONTROL = "public, max-age=60, s-maxage=300, stale-while-revalidate=600";

const CONFIG_COLUMNS =
  "button_color, position, label, animation, header_text, show_badge, welcome_message, starter_questions, last_seen_at, last_seen_host";
const GREETING_COLUMNS = "greeting_enabled, greeting_text";

interface StoredConfig {
  button_color: string;
  position: string;
  label: string;
  animation: string;
  header_text: string;
  show_badge: boolean;
  welcome_message: string | null;
  starter_questions: unknown;
  last_seen_at: string | null;
  last_seen_host: string | null;
  greeting_enabled?: boolean | null;
  greeting_text?: string | null;
}
interface ProjectRead {
  id: string;
  owner_id: string;
  allowed_domains: string[] | null;
  accounts: { plan: string } | { plan: string }[] | null;
  widget_configs: StoredConfig | StoredConfig[] | null;
}

// Postgres "undefined column" (42703), however PostgREST words it.
function isMissingColumn(error: { code?: string; message?: string }): boolean {
  return error.code === "42703" || /column .* does not exist/i.test(error.message ?? "");
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { ...CORS, "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Max-Age": "86400" },
  });
}

export async function GET(req: Request) {
  const query = widgetConfigQuerySchema.safeParse({
    key: new URL(req.url).searchParams.get("key"),
  });
  // A bad or unknown key renders nothing in the widget.
  if (!query.success) return apiError("not_found", "Unknown key.", { headers: CORS });

  // One round trip: the project with its widget config and its owner's plan. Each extra
  // query is a trip to the database, which is what the visitor waits for.
  const service = createServiceClient();
  // The column list is built at run time, which the typed client cannot follow, so the result is typed here.
  const read = (columns: string) =>
    service
      .from("projects")
      .select(`id, owner_id, allowed_domains, accounts(plan), widget_configs(${columns})`)
      .eq("public_key", query.data.key)
      .maybeSingle() as unknown as Promise<{ data: ProjectRead | null; error: { code?: string; message?: string } | null }>;
  let { data: project, error } = await read(`${CONFIG_COLUMNS}, ${GREETING_COLUMNS}`);
  // If the code goes live before the greeting migration has run, those columns do not exist yet and
  // every widget on every site would stop loading. Read without them (greeting off) until it has.
  if (error && isMissingColumn(error)) ({ data: project, error } = await read(CONFIG_COLUMNS));
  if (error) return apiError("internal", "Could not load the config.", { headers: CORS });
  if (!project) return apiError("not_found", "Unknown key.", { headers: CORS });

  // A to-one relation comes back as an object; accept a one-item list too.
  const one = <T,>(value: T | T[] | null): T | null => (Array.isArray(value) ? (value[0] ?? null) : value);
  const stored = one(project.widget_configs);
  const account = one(project.accounts);
  if (!stored || !account) return apiError("internal", "Could not load the config.", { headers: CORS });

  // Only the owner's listed sites may show the widget (an empty list means any site).
  // The loader on the customer's site sends its own Origin. The /embed panel calls from
  // our own address, so it passes the host page's origin along as ?origin=.
  const url = new URL(req.url);
  let host = hostFromHeaders(req.headers);
  if (host && host === url.hostname) host = hostFromOriginParam(url.searchParams.get("origin")) ?? host;
  const allowed = (project.allowed_domains as string[] | null) ?? [];
  if (host !== url.hostname && !isHostAllowed(host, allowed)) {
    return apiError("forbidden", "This site is not allowed to use this key.", { headers: CORS_VARY });
  }

  // Note which site is showing the widget, so the Install page can say "Connected".
  if (host && host !== url.hostname && shouldRecordSeen({ at: stored.last_seen_at, host: stored.last_seen_host }, host, Date.now())) {
    recordSeen(service, project.id, host);
  }

  const rawStarters = Array.isArray(stored.starter_questions)
    ? (stored.starter_questions as string[])
    : DEFAULT_WIDGET_CONFIG.starterQuestions;

  const config: WidgetConfig = applyPlanToConfig(
    {
      buttonColor: stored.button_color,
      position: stored.position as WidgetConfig["position"],
      label: stored.label,
      animation: stored.animation as WidgetConfig["animation"],
      headerText: stored.header_text,
      showBadge: stored.show_badge,
      welcomeMessage: stored.welcome_message ?? DEFAULT_WIDGET_CONFIG.welcomeMessage,
      starterQuestions: rawStarters,
      greetingEnabled: stored.greeting_enabled ?? DEFAULT_WIDGET_CONFIG.greetingEnabled,
      greetingText: stored.greeting_text ?? DEFAULT_WIDGET_CONFIG.greetingText,
    },
    planSchema.parse(account.plan),
  );
  return NextResponse.json(config, { headers: { ...CORS_VARY, "Cache-Control": CONFIG_CACHE_CONTROL } });
}

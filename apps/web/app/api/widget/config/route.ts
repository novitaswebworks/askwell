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
// Browsers keep it for a minute. Vercel's edge keeps it for ten and, after that, serves the old copy
// instantly while it fetches a fresh one in the background, so a visitor almost never waits for the
// database. (Vercel only does this for s-maxage, not for max-age.) A changed colour or text can take
// up to about ten minutes to reach every customer's site.
const CONFIG_CACHE_CONTROL = "public, max-age=60, s-maxage=600, stale-while-revalidate=86400";

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
  const { data: project, error } = await service
    .from("projects")
    .select(
      "id, owner_id, allowed_domains, accounts(plan), widget_configs(button_color, position, label, animation, header_text, show_badge, welcome_message, starter_questions, last_seen_at, last_seen_host)",
    )
    .eq("public_key", query.data.key)
    .maybeSingle();
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
    },
    planSchema.parse(account.plan),
  );
  return NextResponse.json(config, { headers: { ...CORS_VARY, "Cache-Control": CONFIG_CACHE_CONTROL } });
}

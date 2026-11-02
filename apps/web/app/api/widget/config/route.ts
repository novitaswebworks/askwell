import { NextResponse } from "next/server";
import { DEFAULT_WIDGET_CONFIG, planSchema, widgetConfigQuerySchema, type WidgetConfig } from "@askwell/shared";
import { apiError } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/service";
import { hostFromHeaders, recordSeen, shouldRecordSeen } from "@/lib/seen";
import { applyPlanToConfig } from "@/lib/widget-config";

// Public route, called from any website. The key only identifies a project.
const CORS = { "Access-Control-Allow-Origin": "*" };

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

  const service = createServiceClient();
  const { data: project, error } = await service
    .from("projects")
    .select("id, owner_id")
    .eq("public_key", query.data.key)
    .maybeSingle();
  if (error) return apiError("internal", "Could not load the config.", { headers: CORS });
  if (!project) return apiError("not_found", "Unknown key.", { headers: CORS });

  const { data: stored, error: configError } = await service
    .from("widget_configs")
    .select("button_color, position, label, animation, header_text, show_badge, welcome_message, starter_questions, last_seen_at, last_seen_host")
    .eq("project_id", project.id)
    .single();
  if (configError) return apiError("internal", "Could not load the config.", { headers: CORS });

  const { data: account, error: accountError } = await service
    .from("accounts")
    .select("plan")
    .eq("clerk_user_id", project.owner_id)
    .single();
  if (accountError) return apiError("internal", "Could not load the config.", { headers: CORS });

  // Note which site is showing the widget, so the Install page can say "Connected".
  const host = hostFromHeaders(req.headers);
  if (host && shouldRecordSeen({ at: stored.last_seen_at, host: stored.last_seen_host }, host, Date.now())) {
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
  return NextResponse.json(config, { headers: { ...CORS, "Cache-Control": "public, max-age=30" } });
}

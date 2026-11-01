import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPlanLimits, updateConfigSchema, type WidgetConfig } from "@askwell/shared";
import { getAccountPlan } from "@/lib/accounts";
import { track } from "@/lib/analytics";
import { apiError, isUuid, readJson } from "@/lib/api";
import { getOwnedProject } from "@/lib/owned-project";
import { createServiceClient } from "@/lib/supabase/service";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Context) {
  const { userId } = await auth();
  if (!userId) return apiError("unauthorized", "Sign in to continue.");

  const { id } = await params;
  if (!isUuid(id)) return apiError("not_found", "Project not found.");

  const body = await readJson(req);
  const parsed = updateConfigSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("invalid_input", "Provide at least one valid configuration field.");
  }

  const project = await getOwnedProject(id);
  if (!project) return apiError("not_found", "Project not found.");

  // Read the plan on the server; never trust the client.
  const plan = await getAccountPlan(userId);
  if (!getPlanLimits(plan).canCustomize) {
    return apiError("plan_required", "Upgrading to Pro is required to customize the widget.");
  }

  // Only the columns the owner may customize. Service client: owner has SELECT only on widget_configs.
  const updates: Record<string, unknown> = {};
  if (parsed.data.buttonColor !== undefined) updates.button_color = parsed.data.buttonColor;
  if (parsed.data.position !== undefined) updates.position = parsed.data.position;
  if (parsed.data.label !== undefined) updates.label = parsed.data.label;
  if (parsed.data.animation !== undefined) updates.animation = parsed.data.animation;
  if (parsed.data.headerText !== undefined) updates.header_text = parsed.data.headerText;
  if (parsed.data.showBadge !== undefined) updates.show_badge = parsed.data.showBadge;

  const service = createServiceClient();
  const { data, error } = await service
    .from("widget_configs")
    .update(updates)
    .eq("project_id", project.id)
    .select("button_color, position, label, animation, header_text, show_badge")
    .single();

  if (error || !data) return apiError("internal", "Could not update the widget configuration.");

  track({
    distinctId: userId,
    event: "widget_customized",
    properties: { projectId: project.id },
  });

  const config: WidgetConfig = {
    buttonColor: data.button_color,
    position: data.position,
    label: data.label,
    animation: data.animation,
    headerText: data.header_text,
    showBadge: data.show_badge,
  };

  return NextResponse.json(config);
}

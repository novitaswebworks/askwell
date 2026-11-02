import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { addUrlKnowledgeSchema, getPlanLimits } from "@askwell/shared";
import { getAccountPlan } from "@/lib/accounts";
import { track } from "@/lib/analytics";
import { apiError, isUuid, readJson } from "@/lib/api";
import { crawlLimitsFor, crawlSite, NoReadablePagesError, RobotsBlockedError, type PageFetcher } from "@/lib/knowledge/crawl";
import { BlockedAddressError, parsePublicUrl } from "@/lib/knowledge/net-safety";
import { processSource } from "@/lib/knowledge/process";
import { fetchPublic } from "@/lib/knowledge/safe-fetch";
import { limitMessage, processingMessage, toSource, type SourceRow } from "@/lib/knowledge/sources";
import { getOwnedProject } from "@/lib/owned-project";
import { createServiceClient } from "@/lib/supabase/service";

// Reading a site and embedding it can take a while.
export const maxDuration = 300;

const CRAWL_BUDGET_MS = 90_000;
const PAGE_LIMITS = { maxBytes: 1_500_000, timeoutMs: 10_000 };

// The crawler's window onto the network. A page that fails is skipped; only the
// address the owner typed is fatal if it points somewhere private.
function makeFetcher(start: URL): PageFetcher {
  return async (url, kind) => {
    try {
      const accept =
        kind === "page" ? ["text/html", "application/xhtml+xml"] : kind === "robots" ? ["text/plain"] : ["text/xml", "application/xml", "text/plain"];
      return await fetchPublic(url, { ...PAGE_LIMITS, accept });
    } catch (error) {
      if (error instanceof BlockedAddressError && kind === "page" && url.toString() === start.toString()) throw error;
      return null;
    }
  };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return apiError("unauthorized", "Sign in to continue.");

  const { id } = await params;
  if (!isUuid(id)) return apiError("not_found", "Project not found.");

  const parsed = addUrlKnowledgeSchema.safeParse(await readJson(req));
  const start = parsed.success ? parsePublicUrl(parsed.data.url) : null;
  if (!start) return apiError("invalid_input", "Enter a website address like https://example.com.");

  const project = await getOwnedProject(id);
  if (!project) return apiError("not_found", "Project not found.");

  const plan = await getAccountPlan(userId);
  const service = createServiceClient();
  const host = start.hostname.replace(/^www\./, "");
  const { data, error } = await service.rpc("reserve_knowledge_source", {
    p_project_id: project.id,
    p_title: `Website: ${host}`.slice(0, 200),
    p_type: "text",
    p_storage_key: null,
    p_status: "processing",
    p_max_sources: getPlanLimits(plan).maxKnowledgeSources,
  });
  if (error) {
    if (error.code === "P0001") return apiError("limit_reached", limitMessage(plan));
    return apiError("internal", "Could not add the website.");
  }
  const row = data as SourceRow & { project_id: string };

  // Nothing worth keeping if the site could not be read: drop the placeholder row.
  const discard = async () => void (await service.from("knowledge_sources").delete().eq("id", row.id));

  let crawled: Awaited<ReturnType<typeof crawlSite>>;
  try {
    crawled = await crawlSite(start, makeFetcher(start), { ...crawlLimitsFor(plan), deadlineAt: Date.now() + CRAWL_BUDGET_MS });
  } catch (e) {
    await discard();
    if (e instanceof RobotsBlockedError) {
      return apiError("invalid_input", "That website asks not to be read by crawlers (robots.txt). Paste its text instead.");
    }
    if (e instanceof BlockedAddressError) return apiError("invalid_input", "That address can't be read. Use your public website address.");
    if (e instanceof NoReadablePagesError) {
      return apiError("invalid_input", "We couldn't read that website. It may be unreachable, need JavaScript, or need a login. Paste its text instead.");
    }
    return apiError("internal", "We couldn't reach that website. Check the address and try again.");
  }

  try {
    await processSource({ id: row.id, projectId: project.id }, crawled.text, service);
  } catch (e) {
    return apiError("internal", processingMessage(e));
  }
  const title = `Website: ${host} (${crawled.pages} ${crawled.pages === 1 ? "page" : "pages"})`.slice(0, 200);
  await service.from("knowledge_sources").update({ title }).eq("id", row.id);
  track({
    distinctId: userId,
    event: "knowledge_source_added",
    properties: { source_type: "website", plan, pages: crawled.pages },
  });
  return NextResponse.json(toSource({ ...row, title, status: "ready" } satisfies SourceRow), { status: 201 });
}

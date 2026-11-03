import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { addUrlKnowledgeSchema, getPlanLimits, type WebsitePreview } from "@askwell/shared";
import { getAccountPlan } from "@/lib/accounts";
import { track } from "@/lib/analytics";
import { apiError, isUuid, readJson } from "@/lib/api";
import { crawlLimitsFor, crawlSite, NoReadablePagesError, RobotsBlockedError, type PageFetcher } from "@/lib/knowledge/crawl";
import { BlockedAddressError, parsePublicUrl } from "@/lib/knowledge/net-safety";
import { fetchPublic } from "@/lib/knowledge/safe-fetch";
import { limitMessage } from "@/lib/knowledge/sources";
import { getOwnedProject } from "@/lib/owned-project";
import { createServiceClient } from "@/lib/supabase/service";

// Reading a site can take a while.
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

// Reads the site and returns what it found, for the owner to look over and edit. Nothing is
// saved here: the reviewed text is added through the ordinary "paste text" route, which
// checks the plan limit again and does the indexing.
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

  // No point reading a whole site if the project has no room for another source.
  const plan = await getAccountPlan(userId);
  const { count, error: countError } = await createServiceClient()
    .from("knowledge_sources")
    .select("id", { count: "exact", head: true })
    .eq("project_id", project.id);
  if (countError) return apiError("internal", "Could not read the website.");
  if ((count ?? 0) >= getPlanLimits(plan).maxKnowledgeSources) return apiError("limit_reached", limitMessage(plan));

  let crawled: Awaited<ReturnType<typeof crawlSite>>;
  try {
    crawled = await crawlSite(start, makeFetcher(start), { ...crawlLimitsFor(plan), deadlineAt: Date.now() + CRAWL_BUDGET_MS });
  } catch (e) {
    if (e instanceof RobotsBlockedError) {
      return apiError("invalid_input", "That website asks not to be read by crawlers (robots.txt). Paste its text instead.");
    }
    if (e instanceof BlockedAddressError) return apiError("invalid_input", "That address can't be read. Use your public website address.");
    if (e instanceof NoReadablePagesError) {
      return apiError("invalid_input", "We couldn't read that website. It may be unreachable, need JavaScript, or need a login. Paste its text instead.");
    }
    return apiError("internal", "We couldn't reach that website. Check the address and try again.");
  }

  const host = start.hostname.replace(/^www\./, "");
  const title = `Website: ${host} (${crawled.pages} ${crawled.pages === 1 ? "page" : "pages"})`.slice(0, 200);
  track({ distinctId: userId, event: "website_previewed", properties: { plan, pages: crawled.pages, sparse: crawled.sparse } });
  const preview: WebsitePreview = { title, text: crawled.text, pages: crawled.pages, skipped: crawled.skipped, sparse: crawled.sparse };
  return NextResponse.json(preview);
}

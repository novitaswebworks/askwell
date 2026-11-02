import { extractPage, parseSitemap } from "./html";
import { siteKey, parsePublicUrl } from "./net-safety";
import { isAllowedByRobots, parseRobots } from "./robots";

// Reads a website: starts at one address, follows links on the same site, and joins
// what it finds into one document. Network access is injected so this can be tested.

export interface PageResult {
  url: URL;
  status: number;
  wrongType: boolean;
  body: string;
}
export type PageFetcher = (url: URL, kind: "page" | "robots" | "sitemap") => Promise<PageResult | null>;

export interface CrawlOptions {
  maxPages: number;
  maxChars: number;
  deadlineAt: number; // epoch ms: stop starting new pages after this
  delayMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export class RobotsBlockedError extends Error {
  constructor() {
    super("The site asks not to be read by crawlers.");
    this.name = "RobotsBlockedError";
  }
}
export class NoReadablePagesError extends Error {
  constructor() {
    super("No readable pages were found.");
    this.name = "NoReadablePagesError";
  }
}

export function crawlLimitsFor(plan: "free" | "pro") {
  return plan === "pro" ? { maxPages: 40, maxChars: 200_000 } : { maxPages: 10, maxChars: 60_000 };
}

const SKIP_EXTENSIONS = /\.(pdf|jpe?g|png|gif|webp|svg|ico|zip|gz|rar|mp3|mp4|mov|avi|css|js|json|xml|woff2?|ttf|docx?|xlsx?|pptx?)$/i;
const MAX_QUEUE = 500;
const MIN_PAGE_CHARS = 80;
const MIN_TAIL_CHARS = 500;

// One key per page: no fragment, no query (they only create near-duplicates), no trailing slash.
function pageKey(url: URL, keepQuery: boolean): string {
  const path = url.pathname.replace(/\/+$/, "") || "/";
  return `${siteKey(url.hostname)}${path}${keepQuery ? url.search : ""}`;
}

export async function crawlSite(
  start: URL,
  fetcher: PageFetcher,
  options: CrawlOptions,
): Promise<{ text: string; pages: number; skipped: number }> {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const delay = options.delayMs ?? 250;
  const site = siteKey(start.hostname);
  const origin = new URL("/", start);

  // robots.txt: no file (or an unreadable one) means everything is allowed.
  const robotsResponse = await fetcher(new URL("/robots.txt", origin), "robots");
  const rules =
    robotsResponse && robotsResponse.status === 200 && !robotsResponse.wrongType ? parseRobots(robotsResponse.body) : [];
  if (!isAllowedByRobots(rules, start.pathname + start.search)) throw new RobotsBlockedError();

  const queue: URL[] = [start];
  const seen = new Set<string>();
  const enqueue = (candidate: string, base: URL) => {
    if (queue.length >= MAX_QUEUE) return;
    let url: URL | null;
    try {
      url = parsePublicUrl(new URL(candidate, base).toString());
    } catch {
      url = null;
    }
    if (!url || siteKey(url.hostname) !== site || SKIP_EXTENSIONS.test(url.pathname) || url.pathname.length > 200) return;
    url.search = "";
    queue.push(url);
  };

  const sitemap = await fetcher(new URL("/sitemap.xml", origin), "sitemap");
  if (sitemap && sitemap.status === 200 && !sitemap.wrongType) {
    for (const loc of parseSitemap(sitemap.body)) enqueue(loc, origin);
  }

  const parts: string[] = [];
  let chars = 0;
  let pages = 0;
  let skipped = 0;
  let first = true;

  while (queue.length > 0 && pages < options.maxPages && chars < options.maxChars && now() < options.deadlineAt) {
    const url = queue.shift() as URL;
    const key = pageKey(url, url.toString() === start.toString());
    if (seen.has(key)) continue;
    seen.add(key);
    if (!isAllowedByRobots(rules, url.pathname + url.search)) {
      skipped++;
      continue;
    }
    if (!first && delay > 0) await sleep(delay);
    first = false;

    const result = await fetcher(url, "page");
    if (!result || result.status !== 200 || result.wrongType) {
      skipped++;
      continue;
    }
    const page = extractPage(result.body, result.url.toString());
    for (const link of page.links) enqueue(link, result.url);
    if (page.text.length < MIN_PAGE_CHARS) {
      skipped++;
      continue;
    }

    const heading = `# ${page.title || result.url.pathname}\nSource: ${result.url.toString()}\n\n`;
    let section = heading + page.text;
    const room = options.maxChars - chars;
    if (section.length > room) {
      if (room < MIN_TAIL_CHARS) break;
      section = section.slice(0, room);
    }
    parts.push(section);
    chars += section.length + 7;
    pages++;
  }

  if (pages === 0) throw new NoReadablePagesError();
  return { text: parts.join("\n\n---\n\n"), pages, skipped };
}

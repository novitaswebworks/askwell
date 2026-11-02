import * as cheerio from "cheerio";

// Turns a web page into plain text the assistant can search, and lists the links on it.

const DROP = "script, style, noscript, svg, canvas, iframe, form, select, button, nav, footer, aside, template, [aria-hidden='true'], [hidden]";
const BLOCKS = "p, div, section, article, li, ul, ol, h1, h2, h3, h4, h5, h6, br, tr, blockquote, pre, table, dd, dt";

export interface ExtractedPage {
  title: string;
  text: string;
  links: string[];
}

function clean(text: string): string {
  return text
    .replace(/ /g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line, i, all) => line !== "" || (i > 0 && all[i - 1] !== ""))
    .join("\n")
    .trim();
}

export function extractPage(html: string, baseUrl: string): ExtractedPage {
  const $ = cheerio.load(html);

  // Links first: the menu is the best map of a site and is dropped below.
  const links: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")?.trim();
    if (!href || /^(mailto:|tel:|javascript:|data:|#)/i.test(href)) return;
    try {
      links.push(new URL(href, baseUrl).toString());
    } catch {
      // not a usable link
    }
  });

  const title = clean($("title").first().text()) || clean($("h1").first().text());

  $(DROP).remove();
  const root = $("main").length ? $("main").first() : $("article").length ? $("article").first() : $("body");
  root.find("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const level = Number(el.tagName.slice(1));
    $(el).prepend(`${"#".repeat(Math.min(level, 3))} `);
  });
  root.find("li").each((_, el) => void $(el).prepend("- "));
  root.find("a").each((_, el) => void $(el).append(" ")); // links sit next to each other without spacing
  root.find(BLOCKS).each((_, el) => void $(el).append("\n"));
  const text = clean(root.text());

  return { title: title.slice(0, 200), text, links };
}

// Page addresses listed in a sitemap.xml (an index file's own sitemaps are not followed).
export function parseSitemap(xml: string, limit = 500): string[] {
  const urls: string[] = [];
  for (const match of xml.matchAll(/<loc>\s*([^<\s][^<]*?)\s*<\/loc>/gi)) {
    urls.push(match[1].replace(/&amp;/g, "&"));
    if (urls.length >= limit) break;
  }
  return urls;
}

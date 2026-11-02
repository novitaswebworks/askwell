import { PRO_PRICE_INR } from "@askwell/shared";
import { describe, expect, it } from "vitest";
import { FAQ_ITEMS } from "./faq";
import { buildJsonLd, jsonLdString } from "./seo";

const base = "https://askwell.example";
type Node = Record<string, unknown> & { "@type": string };
const graph = buildJsonLd(base)["@graph"] as unknown as Node[];
const byType = (t: string) => graph.find((n) => n["@type"] === t)!;

describe("buildJsonLd", () => {
  it("describes the organization, site and app on the public address", () => {
    expect(byType("Organization")["url"]).toBe(`${base}/`);
    expect(byType("WebSite")["publisher"]).toEqual({ "@id": `${base}/#organization` });
    expect(byType("SoftwareApplication")["applicationCategory"]).toBe("BusinessApplication");
  });
  it("lists the Free and Pro offers with the real price", () => {
    const offers = byType("SoftwareApplication")["offers"] as Array<Record<string, string>>;
    expect(offers.map((o) => [o.name, o.price, o.priceCurrency])).toEqual([
      ["Free", "0", "INR"],
      ["Pro", String(PRO_PRICE_INR), "INR"],
    ]);
  });
  it("turns every visible FAQ item into a question and answer, word for word", () => {
    const qs = byType("FAQPage")["mainEntity"] as Array<{ name: string; acceptedAnswer: { text: string } }>;
    expect(qs).toHaveLength(FAQ_ITEMS.length);
    FAQ_ITEMS.forEach((item, i) => {
      expect(qs[i]!.name).toBe(item.q);
      expect(qs[i]!.acceptedAnswer.text).toBe(item.a);
    });
  });
});

describe("jsonLdString", () => {
  it("escapes < so text cannot close the script tag", () => {
    const out = jsonLdString({ a: "</script><b>" });
    expect(out).not.toContain("<");
    expect(JSON.parse(out).a).toBe("</script><b>");
  });
});

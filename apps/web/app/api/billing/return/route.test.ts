import { afterEach, describe, expect, it } from "vitest";
import { GET, POST } from "./route";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL;
});

const post = (body = "cf_status=ACTIVE&signature=abc") =>
  POST(
    new Request("https://askwell.novitasweb.works/api/billing/return", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    }),
  );

describe("/api/billing/return", () => {
  it("answers Cashfree's POST with a 303 redirect to the Billing page, which turns it into a GET", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://askwell.novitasweb.works/";
    const res = await post();
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://askwell.novitasweb.works/dashboard/billing?checkout=return");
  });
  it("redirects a plain GET the same way", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://askwell.novitasweb.works";
    const res = GET(new Request("https://askwell.novitasweb.works/api/billing/return"));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/dashboard/billing?checkout=return");
  });
  it("falls back to the request's own address when no app URL is set", async () => {
    const res = await post();
    expect(res.headers.get("location")).toBe("https://askwell.novitasweb.works/dashboard/billing?checkout=return");
  });
  it("ignores whatever is in the body: nothing from it can steer the redirect", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://askwell.novitasweb.works";
    const res = await post("cf_status=ACTIVE&return_url=https://evil.example&redirect=https://evil.example");
    expect(res.headers.get("location")).toBe("https://askwell.novitasweb.works/dashboard/billing?checkout=return");
  });
});

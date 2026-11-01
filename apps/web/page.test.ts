import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({
  connection: vi.fn().mockResolvedValue(undefined),
}));

import Home, { LandingWidget } from "./app/(site)/page";

describe("landing page (Home)", () => {
  it("renders with Pro pricing at ₹999 and Free pricing at $0", () => {
    const jsx = Home();
    const html = renderToStaticMarkup(jsx);
    expect(html).toContain("₹999");
    expect(html).toContain("$0");
    expect(html).not.toContain("Pricing announced at launch");
  });

  it("mounts widget script when LANDING_WIDGET_KEY is present", async () => {
    process.env.LANDING_WIDGET_KEY = "pk_landing_test123";
    const widget = await LandingWidget();
    expect(widget).toBeDefined();
    expect(widget?.props?.["data-key"]).toBe("pk_landing_test123");
    expect(widget?.props?.src).toBe("/widget.js");
    delete process.env.LANDING_WIDGET_KEY;
  });

  it("returns null when LANDING_WIDGET_KEY is absent", async () => {
    delete process.env.LANDING_WIDGET_KEY;
    const widget = await LandingWidget();
    expect(widget).toBeNull();
  });
});

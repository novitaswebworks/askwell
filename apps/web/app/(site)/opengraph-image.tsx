import { ImageResponse } from "next/og";
import { APP_NAME } from "@askwell/shared";
import { BrandMark } from "@/lib/brand-mark";

export const alt = `${APP_NAME}: AI chat assistant trained on your own content`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f5f5f4", padding: 80 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <BrandMark size={88} />
          <div style={{ fontSize: 56, fontWeight: 700, color: "#0a0a0a" }}>{APP_NAME}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 80, fontWeight: 700, lineHeight: 1.05, color: "#0a0a0a" }}>
            Your content, answering your customers.
          </div>
          <div style={{ fontSize: 34, color: "#57534e" }}>
            An AI chat assistant for any website. Free to start.
          </div>
        </div>
      </div>
    ),
    size,
  );
}

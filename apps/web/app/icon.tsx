import { ImageResponse } from "next/og";
import { BrandMark } from "@/lib/brand-mark";

// Search engines want a favicon in multiples of 48 px.
export const size = { width: 48, height: 48 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<BrandMark size={48} />, size);
}

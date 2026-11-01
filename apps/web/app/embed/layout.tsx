import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { APP_NAME } from "@askwell/shared";
import "../globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: `${APP_NAME} chat`,
  robots: { index: false },
};

// Its own root layout: the panel runs inside customers' websites, so it must not
// load Clerk or anything else the dashboard needs.
export default function EmbedLayout({ children }: LayoutProps<"/embed">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="h-full">{children}</body>
    </html>
  );
}

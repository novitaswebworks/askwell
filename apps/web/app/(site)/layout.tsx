import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { APP_NAME } from "@askwell/shared";
import { siteUrl } from "@/lib/site";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const serif = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description: "An AI support chat widget for any website.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${serif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up">
          {children}
        </ClerkProvider>
        {/* Page views for our own site only. The embedded chat (app/embed) runs on customers' sites and is left out. */}
        <Analytics />
      </body>
    </html>
  );
}

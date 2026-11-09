import { APP_NAME } from "@askwell/shared";

// The public address search engines should use. The same env var the install snippet uses.
export const FALLBACK_SITE_URL = "https://askwell.novitasweb.works";

export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  return (env.NEXT_PUBLIC_APP_URL?.trim() || FALLBACK_SITE_URL).replace(/\/$/, "");
}

export const HOME_TITLE = `${APP_NAME}: AI chat assistant trained on your own content`;
export const HOME_DESCRIPTION =
  "Add an AI support chat to any website in minutes. Askwell answers visitors from your own pages and documents, stays on topic, and is free to start.";

// Pages a search engine may list. Add each new public page here.
export const PUBLIC_PATHS = ["/", "/terms", "/privacy", "/refunds", "/contact"] as const;

// Never crawled: the signed-in app, the API and the embedded chat panel.
export const PRIVATE_PATHS = ["/dashboard", "/api/", "/embed"] as const;

// The landing page's own widget key, or null when it is unset or not a valid public key. The
// widget loader rejects a malformed key, so the page must not show a chat button for one.
export function landingWidgetKey(env: Record<string, string | undefined> = process.env): string | null {
  const key = env.LANDING_WIDGET_KEY?.trim();
  return key && /^pk_[A-Za-z0-9]{8,64}$/.test(key) ? key : null;
}

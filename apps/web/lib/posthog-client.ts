import posthog from "posthog-js";

// Browser side of PostHog: pageviews, session replay and error capture on the
// marketing site and the dashboard. It never runs inside the chat panel (/embed),
// which shows on other people's websites to their visitors.

let ready: Promise<typeof posthog | null> | undefined;

export function initPostHog(): Promise<typeof posthog | null> {
  if (typeof window === "undefined" || window.location.pathname.startsWith("/embed")) {
    return Promise.resolve(null);
  }
  ready ??= fetch("/api/posthog-config")
    .then((res) => (res.ok ? (res.json() as Promise<{ key: string | null; host: string | null }>) : null))
    .then((config) => {
      if (!config?.key || !config.host) return null;
      posthog.init(config.key, {
        api_host: config.host,
        // People get a profile only once they sign in and are identified.
        person_profiles: "identified_only",
        capture_pageview: "history_change",
        capture_exceptions: true,
        disable_surveys: true,
        session_recording: { maskAllInputs: true },
      });
      return posthog;
    })
    .catch(() => null);
  return ready;
}

// Runs `fn` once PostHog is up. Does nothing when it is not configured.
export function withPostHog(fn: (ph: typeof posthog) => void): void {
  void initPostHog().then((ph) => {
    if (ph) fn(ph);
  });
}

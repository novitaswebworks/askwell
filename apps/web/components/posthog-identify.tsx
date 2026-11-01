"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { withPostHog } from "@/lib/posthog-client";

// Ties dashboard sessions to the signed-in owner by their ID only: no email or
// name is sent to PostHog.
export function PostHogIdentify() {
  const { isLoaded, user } = useUser();
  const userId = user?.id;

  useEffect(() => {
    if (!isLoaded) return;
    withPostHog((ph) => {
      if (userId) {
        if (ph.get_distinct_id() !== userId) ph.identify(userId);
      } else if (ph.get_property("$user_id")) {
        ph.reset();
      }
    });
  }, [isLoaded, userId]);

  return null;
}

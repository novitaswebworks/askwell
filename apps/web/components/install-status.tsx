"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { describeAge, hostLabel, type Connection } from "@/lib/install";
import { LocalTime } from "@/components/local-time";

const POLL_MS = 8_000;
const POLL_FOR_MS = 3 * 60_000;

// Tells the owner whether their website has loaded the widget yet. While waiting
// it re-checks every few seconds for a few minutes, so "Connected" appears by
// itself right after they paste the code.
// It is not re-created when the owner switches project (it just receives the new
// project's data), so the polling below restarts per project through `projectId`.
export function InstallStatus({
  projectId,
  connection,
  seenAt,
}: {
  projectId: string;
  connection: Connection;
  seenAt: string | null;
}) {
  const router = useRouter();
  const waiting = connection.state === "waiting";

  useEffect(() => {
    if (!waiting) return;
    const started = Date.now();
    const id = setInterval(() => {
      if (Date.now() - started > POLL_FOR_MS) return clearInterval(id);
      router.refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [waiting, projectId, router]);

  if (connection.state === "waiting") {
    return (
      <div className="glass flex flex-col gap-1 p-4" role="status">
        <p className="font-medium">Waiting for your website</p>
        <p className="text-sm text-muted">
          Once you paste the code and open your website, this turns green on its own. You don&apos;t need to do anything here.
        </p>
      </div>
    );
  }

  return (
    <div className="glass flex flex-col gap-1 p-4" role="status">
      <p className="flex items-center gap-2 font-medium">
        <span aria-hidden className={`size-2.5 rounded-full ${connection.quiet ? "bg-amber-500" : "bg-green-600"}`} />
        {connection.quiet ? "Seen before, but not lately" : `Connected to ${hostLabel(connection.host)}`}
      </p>
      <p className="text-sm text-muted">
        {connection.quiet ? (
          <>
            Last seen on {hostLabel(connection.host)} {describeAge(connection.ageMinutes)}. If the chat button is gone,
            the code may have been removed. Paste it again below.
          </>
        ) : (
          <>
            Your chat button is live. Last loaded {describeAge(connection.ageMinutes)}
            {seenAt ? (
              <>
                {" "}
                (<LocalTime iso={seenAt} />)
              </>
            ) : null}
            .
          </>
        )}
      </p>
    </div>
  );
}

import "server-only";
import { after } from "next/server";

// Run work once the response has gone out, so the visitor never waits for it. Outside a request
// (tests) it just runs. Failures are swallowed: this is for nice-to-have background work.
export function runAfterResponse(work: () => Promise<unknown>): void {
  const safe = async () => {
    try {
      await work();
    } catch {
      // background only
    }
  };
  try {
    after(safe);
  } catch {
    void safe();
  }
}

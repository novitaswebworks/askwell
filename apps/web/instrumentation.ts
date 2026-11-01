import type { Instrumentation } from "next";

// Reports uncaught server errors to PostHog error tracking.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { captureServerError } = await import("@/lib/analytics");
  await captureServerError(error, {
    path: request.path,
    method: request.method,
    route_path: context.routePath,
    route_type: context.routeType,
  });
};

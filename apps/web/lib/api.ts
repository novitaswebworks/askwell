import { NextResponse } from "next/server";
import type { ApiErrorCode } from "@askwell/shared";

const STATUS: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  invalid_input: 400,
  plan_required: 402,
  limit_reached: 403,
  quota_exceeded: 429,
  rate_limited: 429,
  message_blocked: 422,
  internal: 500,
};

// Every route error has the same shape: { error: { code, message } }.
export function apiError(code: ApiErrorCode, message: string, init?: ResponseInit) {
  return NextResponse.json(
    { error: { code, message } },
    { ...init, status: STATUS[code] },
  );
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID.test(value);

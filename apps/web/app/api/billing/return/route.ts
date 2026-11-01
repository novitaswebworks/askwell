import { NextResponse } from "next/server";

// Where Cashfree sends the customer after the payment page. Cashfree makes this
// trip as a cross-site POST, which a page cannot accept and which carries no
// login cookie, so the request lands here instead. Nothing in the POST body is
// trusted or used (the plan only ever changes through the signed webhook); the
// customer is sent on to the Billing page with a GET, which is a normal
// navigation and keeps them signed in.
function backToBilling(req: Request) {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin).replace(/\/$/, "");
  // 303 turns the POST into a GET.
  return NextResponse.redirect(`${base}/dashboard/billing?checkout=return`, 303);
}

export const POST = backToBilling;
export const GET = backToBilling;

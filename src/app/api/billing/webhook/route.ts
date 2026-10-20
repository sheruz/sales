import { NextResponse } from "next/server";

/** Legacy Stripe webhook — disabled. Use /api/billing/webhooks/paddle */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: { message: "Stripe webhooks are not enabled", code: "GONE" },
    },
    { status: 410 }
  );
}

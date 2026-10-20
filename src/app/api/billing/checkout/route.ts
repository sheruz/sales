import { NextResponse } from "next/server";

/** Legacy Stripe checkout — disabled in B3. */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: { message: "Stripe checkout is not enabled", code: "GONE" },
    },
    { status: 410 }
  );
}

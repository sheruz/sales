import { NextRequest, NextResponse } from "next/server";
import { billingService } from "@/services/billing.service";
import { handleApiError } from "@/lib/api/error-handler";
import { ValidationError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      throw new ValidationError("Missing stripe-signature header");
    }
    const rawBody = await request.text();
    const result = await billingService.handleStripeWebhook(
      rawBody,
      signature
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

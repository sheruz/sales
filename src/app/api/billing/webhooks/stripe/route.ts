import { NextRequest, NextResponse } from "next/server";
import { webhookProcessorService } from "@/services/billing/webhook-processor.service";
import { handleApiError } from "@/lib/api/error-handler";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");
    const result = await webhookProcessorService.receiveStripeWebhook(
      rawBody,
      signature
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

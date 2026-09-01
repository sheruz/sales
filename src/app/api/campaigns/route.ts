import { NextRequest, NextResponse } from "next/server";
import { campaignService } from "@/services/campaign.service";
import { createCampaignSchema } from "@/lib/validations/automation";
import { requirePermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function GET() {
  try {
    await requirePermission("campaigns:read");
    const campaigns = await campaignService.list();
    return NextResponse.json(apiSuccess(campaigns));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission("campaigns:write");
    const body = await request.json();
    const input = createCampaignSchema.parse(body);
    const campaign = await campaignService.create(input);
    return NextResponse.json(apiSuccess(campaign), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

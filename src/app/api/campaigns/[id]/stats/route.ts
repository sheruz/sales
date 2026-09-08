import { NextResponse } from "next/server";
import { campaignService } from "@/services/campaign.service";
import { requireAnyOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const user = await requireAnyOrgPermission([
      "campaigns.manage",
      "campaigns.view",
      "analytics.view",
    ]);
    const { id } = await params;
    const stats = await campaignService.getStats(user.organizationId, id);
    return NextResponse.json(apiSuccess(stats));
  } catch (error) {
    return handleApiError(error);
  }
}

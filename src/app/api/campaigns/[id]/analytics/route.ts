import { NextRequest, NextResponse } from "next/server";
import { campaignAnalyticsService } from "@/services/campaign-analytics.service";
import { requireAnyOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Phase 5 — dual-path campaign analytics (canonical + legacy). Honest metrics only. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAnyOrgPermission([
      "campaigns.manage",
      "campaigns.view",
      "analytics.view",
    ]);
    const { id } = await params;
    const data = await campaignAnalyticsService.getCampaignAnalytics(
      user.organizationId,
      id
    );
    return NextResponse.json(apiSuccess(data));
  } catch (error) {
    return handleApiError(error);
  }
}

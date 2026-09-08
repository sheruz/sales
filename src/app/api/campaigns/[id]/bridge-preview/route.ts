import { NextRequest, NextResponse } from "next/server";
import { campaignLeadBridgeService } from "@/services/campaign-lead-bridge.service";
import { requireAnyOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Phase 5 — cutover preview for CampaignLead → SequenceEnrollment bridge.
 * Read-only. No bulk migrate.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAnyOrgPermission([
      "campaigns.manage",
      "sequences.manage",
      "leads.update",
    ]);
    const { id: campaignId } = await params;
    const url = new URL(request.url);
    const sequenceId = url.searchParams.get("sequenceId");
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw ? Number(limitRaw) : undefined;

    const preview = await campaignLeadBridgeService.previewBridge(
      user.organizationId,
      campaignId,
      {
        sequenceId: sequenceId || null,
        limit: Number.isFinite(limit) ? limit : undefined,
      }
    );
    return NextResponse.json(apiSuccess(preview));
  } catch (error) {
    return handleApiError(error);
  }
}

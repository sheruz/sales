import { NextRequest, NextResponse } from "next/server";
import { campaignLeadBridgeService } from "@/services/campaign-lead-bridge.service";
import { campaignLeadBridgeSchema } from "@/lib/validations/automation";
import { requireAnyOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface RouteParams {
  params: Promise<{ id: string; campaignLeadId: string }>;
}

/**
 * On-demand CampaignLead → Company/Contact → SequenceEnrollment bridge.
 * Idempotent, non-destructive. Cancels PENDING FollowUpJobs for that lead.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAnyOrgPermission([
      "campaigns.manage",
      "sequences.manage",
      "leads.update",
    ]);
    const { id: campaignId, campaignLeadId } = await params;
    const body = await request.json().catch(() => ({}));
    const { organizationId: _ignored, ...rest } = (body ?? {}) as Record<
      string,
      unknown
    >;
    void _ignored;
    const input = campaignLeadBridgeSchema.parse(rest ?? {});

    const result = await campaignLeadBridgeService.bridgeCampaignLead(
      user.organizationId,
      campaignId,
      campaignLeadId,
      {
        sequenceId: input.sequenceId,
        opportunityId: input.opportunityId,
        enrolledById: user.id,
      }
    );
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}

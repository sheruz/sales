import { NextRequest, NextResponse } from "next/server";
import { SequenceEnrollmentStatus } from "@prisma/client";
import { campaignService } from "@/services/campaign.service";
import { sequenceEnrollmentService } from "@/services/sequence-enrollment.service";
import { campaignEnrollSchema } from "@/lib/validations/automation";
import { requireAnyOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** List canonical SequenceEnrollments for a campaign */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAnyOrgPermission([
      "campaigns.manage",
      "sequences.view",
      "sequences.manage",
      "opportunities.view",
    ]);
    const { id: campaignId } = await params;
    // Tenant-scoped campaign check
    await campaignService.getById(user.organizationId, campaignId);

    const sp = request.nextUrl.searchParams;
    const status = sp.get("status") as SequenceEnrollmentStatus | null;
    const result = await sequenceEnrollmentService.list(user.organizationId, {
      campaignId,
      page: Number(sp.get("page") || 1) || 1,
      limit: Number(sp.get("limit") || 50) || 50,
      status: status || undefined,
      sequenceId: sp.get("sequenceId") || undefined,
      contactId: sp.get("contactId") || undefined,
    });
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Enroll Contact (+ optional Opportunity) into campaign sequence.
 * sequenceId optional when campaign.defaultSequenceId is set.
 * Does NOT require Lead.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAnyOrgPermission([
      "campaigns.manage",
      "sequences.manage",
      "opportunities.update",
    ]);
    const { id: campaignId } = await params;
    const body = await request.json();
    const { organizationId: _ignored, ...rest } = body as Record<
      string,
      unknown
    >;
    void _ignored;
    const input = campaignEnrollSchema.parse(rest);

    const enrollment = await campaignService.enrollContact(
      user.organizationId,
      campaignId,
      {
        contactId: input.contactId,
        opportunityId: input.opportunityId,
        sequenceId: input.sequenceId,
        enrolledById: user.id,
      }
    );
    return NextResponse.json(apiSuccess(enrollment), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

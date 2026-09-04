import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SequenceEnrollmentStatus } from "@prisma/client";
import { sequenceEnrollmentService } from "@/services/sequence-enrollment.service";
import { requireAnyOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const enrollSchema = z.object({
  contactId: z.string().uuid(),
  opportunityId: z.string().uuid().optional().nullable(),
  campaignId: z.string().uuid().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
  startImmediately: z.boolean().optional(),
});

/** List enrollments for a sequence */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAnyOrgPermission([
      "sequences.manage",
      "campaigns.manage",
      "opportunities.view",
    ]);
    const { id: sequenceId } = await params;
    const sp = request.nextUrl.searchParams;
    const status = sp.get("status") as SequenceEnrollmentStatus | null;
    const result = await sequenceEnrollmentService.list(user.organizationId, {
      sequenceId,
      page: Number(sp.get("page") || 1) || 1,
      limit: Number(sp.get("limit") || 25) || 25,
      status: status || undefined,
      campaignId: sp.get("campaignId") || undefined,
      opportunityId: sp.get("opportunityId") || undefined,
      contactId: sp.get("contactId") || undefined,
    });
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}

/** Enroll Contact (+ optional Opportunity) into this sequence — no Lead required */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAnyOrgPermission([
      "sequences.manage",
      "campaigns.manage",
      "opportunities.update",
    ]);
    const { id: sequenceId } = await params;
    const body = await request.json();
    const { organizationId: _ignored, ...rest } = body as Record<
      string,
      unknown
    >;
    void _ignored;
    const input = enrollSchema.parse(rest);
    const enrollment = await sequenceEnrollmentService.enroll(
      user.organizationId,
      {
        sequenceId,
        contactId: input.contactId,
        opportunityId: input.opportunityId,
        campaignId: input.campaignId,
        leadId: input.leadId,
        enrolledById: user.id,
        startImmediately: input.startImmediately,
      }
    );
    return NextResponse.json(apiSuccess(enrollment), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

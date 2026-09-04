import { NextRequest, NextResponse } from "next/server";
import { SequenceEnrollmentStopReason } from "@prisma/client";
import { sequenceEnrollmentService } from "@/services/sequence-enrollment.service";
import { requireAnyOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAnyOrgPermission([
      "sequences.manage",
      "campaigns.manage",
      "opportunities.update",
    ]);
    const { id } = await params;
    let reason = SequenceEnrollmentStopReason.MANUAL;
    try {
      const body = await request.json();
      if (
        body?.reason &&
        Object.values(SequenceEnrollmentStopReason).includes(body.reason)
      ) {
        reason = body.reason;
      }
    } catch {
      // no body
    }
    const enrollment = await sequenceEnrollmentService.stop(
      user.organizationId,
      id,
      reason
    );
    return NextResponse.json(apiSuccess(enrollment));
  } catch (error) {
    return handleApiError(error);
  }
}

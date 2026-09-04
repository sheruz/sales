import { NextRequest, NextResponse } from "next/server";
import { sequenceEnrollmentService } from "@/services/sequence-enrollment.service";
import { requireAnyOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await requireAnyOrgPermission([
      "sequences.manage",
      "campaigns.manage",
      "opportunities.update",
    ]);
    const { id } = await params;
    const enrollment = await sequenceEnrollmentService.resume(
      user.organizationId,
      id
    );
    return NextResponse.json(apiSuccess(enrollment));
  } catch (error) {
    return handleApiError(error);
  }
}

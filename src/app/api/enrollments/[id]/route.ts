import { NextRequest, NextResponse } from "next/server";
import { sequenceEnrollmentService } from "@/services/sequence-enrollment.service";
import { requireAnyOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAnyOrgPermission([
      "sequences.view",
      "sequences.manage",
      "campaigns.manage",
      "opportunities.view",
    ]);
    const { id } = await params;
    const enrollment = await sequenceEnrollmentService.getById(
      user.organizationId,
      id
    );
    return NextResponse.json(apiSuccess(enrollment));
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { SequenceEnrollmentStatus } from "@prisma/client";
import { sequenceEnrollmentService } from "@/services/sequence-enrollment.service";
import { requireAnyOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

/** Org-wide enrollment list with filters */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAnyOrgPermission([
      "sequences.manage",
      "campaigns.manage",
      "opportunities.view",
    ]);
    const sp = request.nextUrl.searchParams;
    const status = sp.get("status") as SequenceEnrollmentStatus | null;
    const result = await sequenceEnrollmentService.list(user.organizationId, {
      page: Number(sp.get("page") || 1) || 1,
      limit: Number(sp.get("limit") || 25) || 25,
      status: status || undefined,
      sequenceId: sp.get("sequenceId") || undefined,
      campaignId: sp.get("campaignId") || undefined,
      opportunityId: sp.get("opportunityId") || undefined,
      contactId: sp.get("contactId") || undefined,
    });
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}

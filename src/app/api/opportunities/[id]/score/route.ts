import { NextRequest, NextResponse } from "next/server";
import { opportunityService } from "@/services/opportunity.service";
import { requireOrgPermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: Params) {
  try {
    await requireOrgPermission("opportunities.update");
    const user = await requireOrganizationContext();
    const { id } = await params;
    const score = await opportunityService.scoreOpportunity(
      user.organizationId,
      id
    );
    return NextResponse.json(apiSuccess(score));
  } catch (error) {
    return handleApiError(error);
  }
}

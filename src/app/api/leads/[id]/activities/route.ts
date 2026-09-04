import { NextRequest, NextResponse } from "next/server";
import { activityService } from "@/services/activity.service";
import { requireOrgPermission } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireOrgPermission("leads.view");
    const { id } = await params;
    const activities = await activityService.getByLeadId(
      user.organizationId,
      id
    );
    return NextResponse.json(apiSuccess(activities));
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextResponse } from "next/server";
import { analyticsService } from "@/services/analytics.service";
import { requirePermission, requireOrganizationContext } from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function GET() {
  try {
    await requirePermission("analytics:read");
    const user = await requireOrganizationContext();
    const data = await analyticsService.getFullAnalytics(user.organizationId);
    return NextResponse.json(apiSuccess(data));
  } catch (error) {
    return handleApiError(error);
  }
}

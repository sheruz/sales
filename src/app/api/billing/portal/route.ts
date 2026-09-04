import { NextResponse } from "next/server";
import { billingService } from "@/services/billing.service";
import {
  requireOrgPermission,
  requireOrganizationContext,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function POST() {
  try {
    await requireOrgPermission("billing.manage");
    const user = await requireOrganizationContext();
    const result = await billingService.createPortalSession(
      user.organizationId
    );
    return NextResponse.json(apiSuccess(result));
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextResponse } from "next/server";
import { entitlementService } from "@/services/entitlement.service";
import { isStripeConfigured } from "@/services/billing.service";
import {
  requireOrgPermission,
  requireOrganizationContext,
} from "@/lib/auth/api-auth";
import { apiSuccess } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/error-handler";

export async function GET() {
  try {
    await requireOrgPermission("billing.manage");
    const user = await requireOrganizationContext();
    const snapshot = await entitlementService.getUsageSnapshot(
      user.organizationId
    );
    return NextResponse.json(
      apiSuccess({
        ...snapshot,
        stripeConfigured: isStripeConfigured(),
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}

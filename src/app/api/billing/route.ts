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
    const [snapshot, shadowWouldBlocks] = await Promise.all([
      entitlementService.getUsageSnapshot(user.organizationId),
      entitlementService.getShadowWouldBlocks(user.organizationId),
    ]);
    return NextResponse.json(
      apiSuccess({
        ...snapshot,
        shadowWouldBlocks,
        meteringEnabled: process.env.BILLING_METERING_ENABLED !== "false",
        enforcementEnabled: process.env.BILLING_ENFORCEMENT_ENABLED === "true",
        stripeConfigured: isStripeConfigured(),
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}

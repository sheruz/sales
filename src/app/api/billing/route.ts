import { NextResponse } from "next/server";
import { entitlementService } from "@/services/entitlement.service";
import { isStripeConfigured } from "@/services/billing.service";
import { creditLedgerService } from "@/services/credit-ledger.service";
import prisma from "@/lib/db/prisma";
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
    const [snapshot, shadowWouldBlocks, org, consumed, isOwner] =
      await Promise.all([
        entitlementService.getUsageSnapshot(user.organizationId),
        entitlementService.getShadowWouldBlocks(user.organizationId),
        prisma.organization.findUnique({
          where: { id: user.organizationId },
          select: {
            creditBalanceCached: true,
            billingEnforcementEnabled: true,
            creditsWarnedAt0: true,
            creditsWarnedAt5: true,
            creditsWarnedAt20: true,
          },
        }),
        creditLedgerService.consumedThisMonthByAction(user.organizationId),
        creditLedgerService.isOwnerOrg(user.organizationId),
      ]);
    return NextResponse.json(
      apiSuccess({
        ...snapshot,
        shadowWouldBlocks,
        meteringEnabled: process.env.BILLING_METERING_ENABLED !== "false",
        enforcementEnabled: process.env.BILLING_ENFORCEMENT_ENABLED === "true",
        orgBillingEnforcementEnabled:
          org?.billingEnforcementEnabled === true && !isOwner,
        credits: {
          balance: org?.creditBalanceCached ?? 0,
          isOwner,
          consumedThisMonth: consumed,
          warnings: {
            at20: org?.creditsWarnedAt20 ?? null,
            at5: org?.creditsWarnedAt5 ?? null,
            at0: org?.creditsWarnedAt0 ?? null,
          },
        },
        stripeConfigured: isStripeConfigured(),
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}

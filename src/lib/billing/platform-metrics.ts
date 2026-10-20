/**
 * B4a: Canonical MRR eligibility — used by every Super Admin surface.
 *
 * MRR = sum of ACTIVE + PAST_DUE subscriptions' monthly-equivalent price
 * (yearly/12), per environment, excluding:
 * - PLATFORM_OWNER_ORG_ID
 * - plan codes OWNER, COMPLIMENTARY
 * - manual access not yet paid (accessMode=manual without a completed payment marker)
 */

import { SubscriptionStatus } from "@prisma/client";

export const EXCLUDED_MRR_PLAN_CODES = new Set(["OWNER", "COMPLIMENTARY"]);

export type MrrSubscriptionInput = {
  status: SubscriptionStatus | string;
  billingInterval?: string | null;
  accessMode?: string | null;
  provider?: string | null;
  organizationId: string;
  planCode?: string | null;
  priceMonthly?: number | string | null;
  priceYearly?: number | string | null;
  /** When true, manual subscription has a recorded paid invoice / payment */
  manualPaid?: boolean;
};

export function monthlyEquivalent(input: {
  billingInterval?: string | null;
  priceMonthly?: number | string | null;
  priceYearly?: number | string | null;
}): number {
  const monthly = Number(input.priceMonthly ?? 0);
  const yearly = Number(input.priceYearly ?? 0);
  if (input.billingInterval === "YEARLY") {
    return yearly > 0 ? yearly / 12 : 0;
  }
  return monthly > 0 ? monthly : 0;
}

export function isMrrEligible(
  input: MrrSubscriptionInput,
  ownerOrgId?: string | null
): boolean {
  if (ownerOrgId && input.organizationId === ownerOrgId) return false;

  const status = String(input.status);
  if (
    status !== SubscriptionStatus.ACTIVE &&
    status !== SubscriptionStatus.PAST_DUE
  ) {
    return false;
  }

  const code = (input.planCode || "").toUpperCase();
  if (EXCLUDED_MRR_PLAN_CODES.has(code)) return false;

  const mode = (input.accessMode || "").toLowerCase();
  if (mode === "complimentary") return false;

  // Manual invoiced but not paid yet → not MRR
  if (mode === "manual" && input.manualPaid === false) return false;

  const provider = (input.provider || "").toUpperCase();
  if (
    (provider.startsWith("MANUAL") || mode === "manual") &&
    input.manualPaid === false
  ) {
    return false;
  }

  return true;
}

export function mrrContribution(
  input: MrrSubscriptionInput,
  ownerOrgId?: string | null
): number {
  if (!isMrrEligible(input, ownerOrgId)) return 0;
  return monthlyEquivalent(input);
}

import type {
  BillingProviderId,
  PaymentProvider,
} from "@/services/billing/provider-types";
import { paddleProvider } from "@/services/billing/paddle.provider";
import {
  manualBankProvider,
  manualPayoneerProvider,
} from "@/services/billing/manual.provider";
import { stripeStubProvider } from "@/services/billing/stripe.provider";
import prisma from "@/lib/db/prisma";

export function getProvider(id: BillingProviderId | string): PaymentProvider {
  switch (id) {
    case "PADDLE":
      return paddleProvider;
    case "MANUAL_PAYONEER":
      return manualPayoneerProvider;
    case "MANUAL_BANK":
      return manualBankProvider;
    case "STRIPE":
      return stripeStubProvider;
    default:
      return paddleProvider;
  }
}

export async function getProviderForOrganization(
  organizationId: string
): Promise<PaymentProvider> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { billingProvider: true },
  });
  return getProvider(org?.billingProvider || "PADDLE");
}

/** Called from plan editor — sync only when Paddle configured + payments path */
export async function syncProductAndPrices(input: {
  planId: string;
  planVersionId: string;
  reason?: string;
}) {
  return paddleProvider.syncProductAndPrices(input);
}

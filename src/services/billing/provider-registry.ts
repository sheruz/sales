import type {
  BillingProviderId,
  PaymentProvider,
} from "@/services/billing/provider-types";
import { paddleProvider } from "@/services/billing/paddle.provider";
import {
  manualBankProvider,
  manualPayoneerProvider,
} from "@/services/billing/manual.provider";
import { stripeProvider } from "@/services/billing/stripe.provider";
import { paymentConfigService } from "@/services/billing/payment-config.service";
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
      return stripeProvider;
    default:
      return paddleProvider;
  }
}

export async function getProviderForOrganization(
  organizationId: string
): Promise<PaymentProvider> {
  const providerId =
    await paymentConfigService.resolveOrgProvider(organizationId);
  return getProvider(providerId);
}

/** Card providers that participate in product sync */
const SYNC_PROVIDERS: BillingProviderId[] = ["PADDLE", "STRIPE"];

/**
 * Sync plan version to every enabled card provider (current mode).
 * Disabled providers are skipped for new sync; existing maps remain.
 */
export async function syncProductAndPrices(input: {
  planId: string;
  planVersionId: string;
  reason?: string;
  providers?: BillingProviderId[];
}): Promise<{
  results: Array<{
    provider: string;
    ok: boolean;
    error?: string;
    productId?: string;
    priceIds?: string[];
  }>;
}> {
  const configs = await paymentConfigService.listProviderConfigs();
  const targets = (input.providers || SYNC_PROVIDERS).filter((p) => {
    const row = configs.find((c) => c.provider === p);
    return row?.enabled;
  });

  const results: Array<{
    provider: string;
    ok: boolean;
    error?: string;
    productId?: string;
    priceIds?: string[];
  }> = [];

  for (const providerId of targets) {
    try {
      const provider = getProvider(providerId);
      const r = await provider.syncProductAndPrices({
        planId: input.planId,
        planVersionId: input.planVersionId,
        reason: input.reason,
      });
      results.push({
        provider: providerId,
        ok: r.ok,
        productId: r.productId,
        priceIds: r.priceIds,
      });
    } catch (err) {
      results.push({
        provider: providerId,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (targets.length === 0) {
    results.push({
      provider: "none",
      ok: true,
      error: "No enabled card providers to sync",
    });
  }

  return { results };
}

export async function syncTopUpToEnabledProviders(topUpPackId: string) {
  const configs = await paymentConfigService.listProviderConfigs();
  const results: Array<{ provider: string; ok: boolean; error?: string }> = [];
  for (const p of SYNC_PROVIDERS) {
    const row = configs.find((c) => c.provider === p);
    if (!row?.enabled) continue;
    try {
      await getProvider(p).syncTopUpPack({ topUpPackId });
      results.push({ provider: p, ok: true });
    } catch (err) {
      results.push({
        provider: p,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}

/** Sync all published plan versions + active top-up packs to one or all enabled providers. */
export async function syncAllPublishedPackages(input?: {
  providers?: BillingProviderId[];
}) {
  const versions = await prisma.planVersion.findMany({
    where: {
      status: "PUBLISHED",
      plan: {
        archivedAt: null,
        visibility: "PUBLIC",
        code: { notIn: ["OWNER", "COMPLIMENTARY", "UNASSIGNED"] },
      },
    },
    select: { id: true, planId: true },
  });
  const packs = await prisma.topUpPack.findMany({
    where: { active: true },
    select: { id: true },
  });

  const items: Array<{
    kind: "plan" | "topup";
    id: string;
    results: Array<{ provider: string; ok: boolean; error?: string }>;
  }> = [];

  for (const v of versions) {
    const { results } = await syncProductAndPrices({
      planId: v.planId,
      planVersionId: v.id,
      providers: input?.providers,
    });
    items.push({ kind: "plan", id: v.id, results });
  }
  for (const p of packs) {
    const results = await syncTopUpToEnabledProviders(p.id);
    items.push({ kind: "topup", id: p.id, results });
  }

  return { items, total: items.length };
}

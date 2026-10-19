/**
 * B2 stub — real MANUAL_PAYONEER / Stripe sync lands in B3.
 * syncProductAndPrices is intentionally a no-op.
 */

import { logger } from "@/lib/logger";

export type ApplyMode = "now" | "renewal" | "new_subscribers_only";

export class PaymentProviderStub {
  async syncProductAndPrices(input: {
    planId: string;
    planVersionId: string;
    reason?: string;
  }): Promise<{ ok: true; stub: true }> {
    logger.info("provider sync pending — B3", {
      planId: input.planId,
      planVersionId: input.planVersionId,
      reason: input.reason ?? null,
      provider: "MANUAL_PAYONEER",
    });
    return { ok: true, stub: true };
  }
}

export const paymentProviderStub = new PaymentProviderStub();

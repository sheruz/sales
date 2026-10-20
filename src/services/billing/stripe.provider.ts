/**
 * Stripe stub — routes return 410; methods throw.
 */

import { ValidationError } from "@/lib/api/response";
import type { PaymentProvider } from "@/services/billing/provider-types";

function disabled(): never {
  throw new ValidationError("Stripe is not enabled");
}

export class StripeStubProvider implements PaymentProvider {
  readonly id = "STRIPE" as const;

  createCustomer = disabled;
  syncProductAndPrices = disabled;
  syncTopUpPack = disabled;
  createCheckout = disabled;
  createTopUpCheckout = disabled;
  createPortalSession = disabled;
  changeSubscription = disabled;
  cancelSubscription = disabled;
  resumeSubscription = disabled;
  verifyWebhook = disabled;
  mapEvent = disabled;

  async testConnection() {
    return { ok: false, message: "Stripe is not enabled (stub)" };
  }
}

export const stripeStubProvider = new StripeStubProvider();

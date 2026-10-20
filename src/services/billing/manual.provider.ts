/**
 * MANUAL_PAYONEER / MANUAL_BANK adapter — invoice-based, no Payoneer API.
 */

import { ValidationError } from "@/lib/api/response";
import type { PaymentProvider } from "@/services/billing/provider-types";
import { invoiceService } from "@/services/billing/invoice.service";

export class ManualProvider implements PaymentProvider {
  constructor(readonly id: "MANUAL_PAYONEER" | "MANUAL_BANK") {}

  async createCustomer() {
    return { externalCustomerId: `manual:${this.id}` };
  }

  async syncProductAndPrices() {
    return { ok: true };
  }

  async syncTopUpPack() {
    return { ok: true };
  }

  async createCheckout(input: {
    organizationId: string;
    planVersionId: string;
    interval: "MONTHLY" | "YEARLY";
    customerEmail: string;
    successUrl: string;
    cancelUrl: string;
  }) {
    const invoice = await invoiceService.createSubscriptionInvoice({
      organizationId: input.organizationId,
      planVersionId: input.planVersionId,
      interval: input.interval,
      provider: this.id,
      billingEmail: input.customerEmail,
    });
    return {
      mode: "manual_invoice" as const,
      invoiceId: invoice.id,
    };
  }

  async createTopUpCheckout(input: {
    organizationId: string;
    topUpPackId: string;
    customerEmail: string;
    successUrl: string;
    cancelUrl: string;
  }) {
    const invoice = await invoiceService.createTopUpInvoice({
      organizationId: input.organizationId,
      topUpPackId: input.topUpPackId,
      provider: this.id,
      billingEmail: input.customerEmail,
    });
    return {
      mode: "manual_invoice" as const,
      invoiceId: invoice.id,
    };
  }

  async createPortalSession(_input: {
    organizationId: string;
    returnUrl: string;
  }): Promise<{ url: string }> {
    throw new ValidationError("Customer portal is not available for manual billing");
  }

  async changeSubscription(input: {
    organizationId: string;
    planVersionId: string;
    interval: "MONTHLY" | "YEARLY";
    proration: boolean;
    effective: "immediate" | "period_end";
  }) {
    await invoiceService.createProrationInvoice({
      organizationId: input.organizationId,
      planVersionId: input.planVersionId,
      interval: input.interval,
      provider: this.id,
      activateOnPayment: true,
    });
    return { ok: true };
  }

  async cancelSubscription() {
    return { ok: true };
  }

  async resumeSubscription() {
    return { ok: true };
  }

  async verifyWebhook(_input: {
    rawBody: string;
    signatureHeader: string | null;
  }): Promise<{
    eventId: string;
    eventType: string;
    payload: unknown;
    occurredAt: Date;
  }> {
    throw new ValidationError("Manual provider has no webhooks");
  }

  async mapEvent() {
    return { type: "unmatched" as const, reason: "manual provider" };
  }

  async testConnection() {
    return { ok: true, message: `${this.id} ready (invoice-based)` };
  }
}

export const manualPayoneerProvider = new ManualProvider("MANUAL_PAYONEER");
export const manualBankProvider = new ManualProvider("MANUAL_BANK");

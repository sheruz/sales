/**
 * B3 payment provider adapter types (spec §10).
 */

export type BillingProviderId =
  | "PADDLE"
  | "MANUAL_PAYONEER"
  | "MANUAL_BANK"
  | "STRIPE";

export type ProviderEnvironment = "sandbox" | "production";

export type BillingIntervalKind = "MONTHLY" | "YEARLY" | "ONE_TIME";

export type MoneyFields = {
  amount?: number;
  taxAmount?: number | null;
  feeAmount?: number | null;
  netAmount?: number | null;
  currency?: string;
};

export type MappedBillingEvent =
  | ({
      type: "subscription_activated";
      organizationId: string;
      planVersionId: string;
      interval: "MONTHLY" | "YEARLY";
      externalCustomerId: string;
      externalSubscriptionId: string;
      currentPeriodStart: Date;
      currentPeriodEnd: Date;
      transactionId?: string;
      trialEndsAt?: Date | null;
    } & MoneyFields)
  | {
      type: "subscription_updated";
      organizationId: string;
      externalSubscriptionId: string;
      planVersionId?: string;
      interval?: "MONTHLY" | "YEARLY";
      status?: string;
      currentPeriodStart?: Date;
      currentPeriodEnd?: Date;
      cancelAtPeriodEnd?: boolean;
      occurredAt: Date;
    }
  | {
      type: "subscription_canceled";
      organizationId: string;
      externalSubscriptionId: string;
      occurredAt: Date;
    }
  | {
      type: "payment_failed";
      organizationId: string;
      externalSubscriptionId: string;
      occurredAt: Date;
    }
  | ({
      type: "renewal_paid";
      organizationId: string;
      externalSubscriptionId: string;
      transactionId: string;
      currentPeriodStart: Date;
      currentPeriodEnd: Date;
      occurredAt: Date;
    } & MoneyFields)
  | ({
      type: "topup_paid";
      organizationId: string;
      topUpPackId: string;
      transactionId: string;
      credits: number;
      occurredAt: Date;
    } & MoneyFields)
  | ({
      type: "refund_or_chargeback";
      organizationId: string | null;
      externalSubscriptionId?: string;
      transactionId?: string;
      isChargeback: boolean;
      occurredAt: Date;
    } & MoneyFields)
  | {
      type: "unmatched";
      reason: string;
    }
  | {
      /** Ignored / not actionable — never counts as failed */
      type: "skipped";
      reason: string;
    };

export interface PaymentProvider {
  readonly id: BillingProviderId;

  createCustomer(input: {
    organizationId: string;
    email: string;
    name: string;
  }): Promise<{ externalCustomerId: string }>;

  syncProductAndPrices(input: {
    planId: string;
    planVersionId: string;
    reason?: string;
  }): Promise<{ ok: boolean; productId?: string; priceIds?: string[] }>;

  syncTopUpPack(input: {
    topUpPackId: string;
  }): Promise<{ ok: boolean; priceId?: string }>;

  createCheckout(input: {
    organizationId: string;
    planVersionId: string;
    interval: "MONTHLY" | "YEARLY";
    customerEmail: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{
    mode: "paddle_overlay" | "redirect" | "manual_invoice";
    transactionId?: string;
    clientToken?: string;
    checkoutUrl?: string;
    invoiceId?: string;
  }>;

  createTopUpCheckout(input: {
    organizationId: string;
    topUpPackId: string;
    customerEmail: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{
    mode: "paddle_overlay" | "redirect" | "manual_invoice";
    transactionId?: string;
    clientToken?: string;
    invoiceId?: string;
  }>;

  createPortalSession(input: {
    organizationId: string;
    returnUrl: string;
  }): Promise<{ url: string }>;

  changeSubscription(input: {
    organizationId: string;
    planVersionId: string;
    interval: "MONTHLY" | "YEARLY";
    proration: boolean;
    effective: "immediate" | "period_end";
  }): Promise<{ ok: boolean }>;

  cancelSubscription(input: {
    organizationId: string;
    atPeriodEnd: boolean;
  }): Promise<{ ok: boolean }>;

  resumeSubscription(input: {
    organizationId: string;
  }): Promise<{ ok: boolean }>;

  verifyWebhook(input: {
    rawBody: string;
    signatureHeader: string | null;
  }): Promise<{ eventId: string; eventType: string; payload: unknown; occurredAt: Date }>;

  mapEvent(payload: unknown): Promise<MappedBillingEvent>;

  testConnection(): Promise<{ ok: boolean; message: string }>;
}

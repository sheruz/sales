/**
 * B2/B3: ApplyMode type kept here for plan editor.
 * Real sync lives in billing/provider-registry (Paddle).
 */

export type ApplyMode = "now" | "renewal" | "new_subscribers_only";

export { syncProductAndPrices } from "@/services/billing/provider-registry";

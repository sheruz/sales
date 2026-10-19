/** Structured billing block / pause reasons (S2.5). Provider errors stay separate. */
export const BILLING_REASONS = {
  SUBSCRIPTION_INACTIVE: "SUBSCRIPTION_INACTIVE",
  PLAN_FEATURE_DISABLED: "PLAN_FEATURE_DISABLED",
  PLAN_LIMIT_REACHED: "PLAN_LIMIT_REACHED",
  OUT_OF_CREDITS: "OUT_OF_CREDITS",
  PROVIDER_KEY_MISSING: "PROVIDER_KEY_MISSING",
  PROVIDER_OUT_OF_CREDITS: "PROVIDER_OUT_OF_CREDITS",
  DAILY_EMAIL_LIMIT: "DAILY_EMAIL_LIMIT",
  MONTHLY_EMAIL_LIMIT: "MONTHLY_EMAIL_LIMIT",
} as const;

export type BillingReason =
  (typeof BILLING_REASONS)[keyof typeof BILLING_REASONS];

export function isBillingPauseReason(reason: string | undefined | null): boolean {
  if (!reason) return false;
  return (
    reason === BILLING_REASONS.OUT_OF_CREDITS ||
    reason === BILLING_REASONS.PLAN_LIMIT_REACHED ||
    reason === BILLING_REASONS.DAILY_EMAIL_LIMIT ||
    reason === BILLING_REASONS.MONTHLY_EMAIL_LIMIT ||
    reason === BILLING_REASONS.PLAN_FEATURE_DISABLED ||
    reason === BILLING_REASONS.SUBSCRIPTION_INACTIVE
  );
}

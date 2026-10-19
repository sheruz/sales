/**
 * Global BILLING_ENFORCEMENT_ENABLED is an emergency kill switch.
 * Production must set it explicitly (true once tests pass).
 * If missing: treat as OFF and surface startup / ops warnings.
 */

const raw = process.env.BILLING_ENFORCEMENT_ENABLED;

export function isBillingEnforcementEnvExplicit(): boolean {
  return raw !== undefined && String(raw).trim() !== "";
}

export function isGlobalBillingEnforcementOn(): boolean {
  if (!isBillingEnforcementEnvExplicit()) return false;
  const v = String(raw).trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

/** Log once at import / startup when unset. */
export function logBillingEnforcementStartupWarning(): void {
  if (!isBillingEnforcementEnvExplicit()) {
    console.warn(
      "[billing] BILLING_ENFORCEMENT_ENABLED is not set. " +
        "Set it explicitly to true in production. " +
        "While unset, global enforcement is OFF (kill-switch safe default)."
    );
  } else if (!isGlobalBillingEnforcementOn()) {
    console.warn(
      "[billing] BILLING_ENFORCEMENT_ENABLED=false — global kill switch OFF; " +
        "per-org limits/credits will not block."
    );
  }
}

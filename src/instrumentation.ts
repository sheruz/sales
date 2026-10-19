export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logBillingEnforcementStartupWarning } = await import(
      "@/lib/billing/enforcement-flags"
    );
    logBillingEnforcementStartupWarning();
  }
}

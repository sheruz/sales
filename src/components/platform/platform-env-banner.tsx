import type { PlatformBillingEnv } from "@/lib/platform/environment-preference";

export function PlatformEnvBanner({
  billingEnv,
}: {
  billingEnv: PlatformBillingEnv;
}) {
  if (billingEnv !== "sandbox") return null;
  return (
    <div className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-900 dark:text-amber-100">
      Viewing <strong>Test</strong> (sandbox) billing data — not Live revenue.
    </div>
  );
}

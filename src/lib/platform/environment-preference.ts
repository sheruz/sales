/**
 * Super Admin preferred billing environment (Live vs Test).
 * Stored in a cookie so server components and list APIs share one source.
 */

export const PLATFORM_BILLING_ENV_COOKIE = "platform_billing_env";

export type PlatformBillingEnv = "production" | "sandbox";

export function parsePlatformBillingEnv(
  raw: string | undefined | null
): PlatformBillingEnv {
  if (raw === "sandbox" || raw === "test") return "sandbox";
  return "production";
}

export function platformBillingEnvLabel(env: PlatformBillingEnv): string {
  return env === "production" ? "Live" : "Test";
}

/** Client-side write; call router.refresh() after. */
export function writePlatformBillingEnvCookie(env: PlatformBillingEnv): void {
  if (typeof document === "undefined") return;
  document.cookie = `${PLATFORM_BILLING_ENV_COOKIE}=${env}; path=/; max-age=31536000; SameSite=Lax`;
}

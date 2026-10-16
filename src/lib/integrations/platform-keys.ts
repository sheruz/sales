import { env } from "@/lib/config/env";

/**
 * Platform .env provider keys belong to Delvix only.
 * Bound to PLATFORM_OWNER_ORG_ID — never to "any org on OWNER plan".
 */
export function canUsePlatformProviderKeys(organizationId: string): boolean {
  const ownerOrgId = env.PLATFORM_OWNER_ORG_ID;
  if (!ownerOrgId) return false;
  return organizationId === ownerOrgId;
}

export function platformKeyMissingMessage(providerLabel: string): string {
  return `Connect your ${providerLabel} in Settings → Integrations. Platform keys are not available for this workspace.`;
}

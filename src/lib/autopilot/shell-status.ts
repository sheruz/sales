import { cronTickService } from "@/services/cron-tick.service";
import { outboundConfigService } from "@/services/outbound-config.service";
import { sourcingJobService } from "@/services/sourcing-job.service";
import { enrichmentJobService } from "@/services/enrichment-job.service";
import { websiteAuditService } from "@/services/website-audit.service";

export type AutopilotShellStatus = {
  tone: "ok" | "warn" | "bad";
  label: string;
  lastRunAt: string | null;
  minutesAgo: number | null;
  /** True when no pipeline has ever been turned on for this org */
  neverConfigured?: boolean;
};

function formatAgo(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60_000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/**
 * Sidebar footer pill — real cron + master toggles.
 * green: any pipeline on + last cron < 15m
 * amber: all master toggles off (Paused)
 * red: pipeline on but cron missing/stale > 15m
 */
export async function getAutopilotShellStatus(
  organizationId: string
): Promise<AutopilotShellStatus> {
  const [sourcing, enrichment, audit, outbound, lastTick] = await Promise.all([
    sourcingJobService.getConfig(organizationId).catch(() => ({
      enabled: false,
    })),
    enrichmentJobService.getConfig(organizationId).catch(() => ({
      enabled: false,
    })),
    websiteAuditService.getConfig(organizationId).catch(() => ({
      enabled: false,
    })),
    outboundConfigService.getConfig(organizationId).catch(() => ({
      enabled: false,
    })),
    cronTickService.lastTick(),
  ]);

  const anyOn = Boolean(
    sourcing.enabled ||
      enrichment.enabled ||
      audit.enabled ||
      outbound.enabled
  );

  const lastAt = lastTick
    ? (lastTick.finishedAt ?? lastTick.startedAt)
    : null;
  const ageMs = lastAt ? Date.now() - lastAt.getTime() : null;
  const minutesAgo =
    ageMs != null ? Math.max(0, Math.floor(ageMs / 60_000)) : null;
  const stale = cronTickService.isStale(lastTick);

  if (!anyOn) {
    // Brand-new orgs: no master toggles on → setup, not "paused"
    return {
      tone: "warn",
      label: "not_setup",
      lastRunAt: lastAt?.toISOString() ?? null,
      minutesAgo,
      neverConfigured: true,
    };
  }

  if (stale || !lastTick) {
    const ago = ageMs != null ? formatAgo(ageMs) : null;
    return {
      tone: "bad",
      label: ago
        ? `Not running · last run ${ago} ago`
        : "Not running · no cron yet",
      lastRunAt: lastAt?.toISOString() ?? null,
      minutesAgo,
    };
  }

  const ago = formatAgo(ageMs!);
  return {
    tone: "ok",
    label: `Autopilot running · last run ${ago} ago`,
    lastRunAt: lastAt!.toISOString(),
    minutesAgo,
  };
}

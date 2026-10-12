import type {
  CompanyCrawlStatus,
  CompanyEnrichmentStatus,
  OpportunityStage,
} from "@prisma/client";

/** Product funnel stages shown on Autopilot Overview / company badges */
export type FunnelStageKey =
  | "found"
  | "crawled"
  | "enriched"
  | "audited"
  | "contacted"
  | "replied"
  | "meeting"
  | "won";

export const FUNNEL_STAGES: Array<{
  key: FunnelStageKey;
  label: string;
  phase: number;
  comingSoon?: boolean;
}> = [
  { key: "found", label: "Found", phase: 1 },
  { key: "crawled", label: "Crawled", phase: 1 },
  { key: "enriched", label: "Enriched", phase: 2 },
  { key: "audited", label: "Audited", phase: 3 },
  { key: "contacted", label: "Contacted", phase: 4, comingSoon: true },
  { key: "replied", label: "Replied", phase: 5, comingSoon: true },
  { key: "meeting", label: "Meeting booked", phase: 5, comingSoon: true },
  { key: "won", label: "Won", phase: 5, comingSoon: true },
];

export function deriveCompanyFunnelStage(input: {
  crawlStatus?: CompanyCrawlStatus | null;
  enrichmentStatus?: CompanyEnrichmentStatus | null;
  opportunityStage?: OpportunityStage | null;
  /** Company auditStatus === DONE or has a successful WebsiteAudit */
  audited?: boolean | null;
}): FunnelStageKey {
  const opp = input.opportunityStage;
  if (opp === "WON") return "won";
  if (opp === "MEETING") return "meeting";
  if (opp === "REPLIED") return "replied";
  if (opp === "CONTACTED" || opp === "QUALIFIED" || opp === "NEW") {
    return "contacted";
  }
  if (input.audited) return "audited";
  if (input.enrichmentStatus === "ENRICHED") return "enriched";
  if (
    input.crawlStatus === "DONE" ||
    input.crawlStatus === "BLOCKED" ||
    input.crawlStatus === "FAILED"
  ) {
    return "crawled";
  }
  return "found";
}

export function funnelStageLabel(key: FunnelStageKey): string {
  return FUNNEL_STAGES.find((s) => s.key === key)?.label ?? key;
}

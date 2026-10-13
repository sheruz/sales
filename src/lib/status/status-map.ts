/**
 * Single status → sentence-case label + tone.
 * Extend in R2/R3 as stages consolidate.
 */

export type StatusTone =
  | "ok"
  | "warn"
  | "bad"
  | "info"
  | "brand"
  | "neutral";

export type StatusMapping = {
  label: string;
  tone: StatusTone;
};

function sentenceCase(raw: string): string {
  const s = raw.trim().replace(/_/g, " ");
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

const EXACT: Record<string, StatusMapping> = {
  ACTIVE: { label: "Active", tone: "ok" },
  PAUSED: { label: "Paused", tone: "warn" },
  ERROR: { label: "Error", tone: "bad" },
  DONE: { label: "Done", tone: "ok" },
  PENDING: { label: "Pending", tone: "neutral" },
  RUNNING: { label: "Running", tone: "info" },
  FAILED: { label: "Failed", tone: "bad" },
  SKIPPED: { label: "Skipped", tone: "warn" },
  ENRICHED: { label: "Enriched", tone: "ok" },
  CONTACTED: { label: "Contacted", tone: "info" },
  APPROVED: { label: "Approved", tone: "ok" },
  DRAFT: { label: "Draft", tone: "neutral" },
  REJECTED: { label: "Rejected", tone: "bad" },
  QUEUED: { label: "Queued", tone: "info" },
  SENT: { label: "Sent", tone: "ok" },
  HELD: { label: "Held", tone: "warn" },
  WAITING: { label: "Waiting", tone: "warn" },
  OPEN: { label: "Open", tone: "info" },
  CLOSED: { label: "Closed", tone: "neutral" },
  WON: { label: "Won", tone: "ok" },
  LOST: { label: "Lost", tone: "bad" },
};

export function mapStatus(raw: string | null | undefined): StatusMapping {
  if (!raw?.trim()) return { label: "—", tone: "neutral" };
  const key = raw.trim().toUpperCase().replace(/\s+/g, "_");
  if (EXACT[key]) return EXACT[key];
  return { label: sentenceCase(raw), tone: "neutral" };
}

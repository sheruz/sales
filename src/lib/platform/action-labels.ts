/** Friendly labels for credit action types + audit actions */

const CREDIT_ACTIONS: Record<string, string> = {
  google_sourcing_page: "Google sourcing (per page)",
  crawl: "Website crawl",
  enrichment: "Lead enrichment",
  audit_pitch: "Audit + pitch",
  ai_reply_classification: "AI reply classify",
  ai_reply_draft: "AI reply draft",
  email_sent: "Email sent",
  meeting_booked: "Meeting booked",
};

export function creditActionLabel(actionType: string): string {
  return CREDIT_ACTIONS[actionType] || actionType.replace(/_/g, " ");
}

export function auditActionLabel(action: string): string {
  return action
    .replace(/^platform\./, "")
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function diffKeys(
  before: unknown,
  after: unknown
): Array<{ key: string; from: string; to: string }> {
  const a =
    before && typeof before === "object" && !Array.isArray(before)
      ? (before as Record<string, unknown>)
      : {};
  const b =
    after && typeof after === "object" && !Array.isArray(after)
      ? (after as Record<string, unknown>)
      : {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: Array<{ key: string; from: string; to: string }> = [];
  for (const key of keys) {
    const from = JSON.stringify(a[key] ?? null);
    const to = JSON.stringify(b[key] ?? null);
    if (from !== to) out.push({ key, from, to });
  }
  return out.slice(0, 12);
}

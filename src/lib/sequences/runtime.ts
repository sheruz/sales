/**
 * Sequence template variable rendering (deterministic, no AI).
 * Supported keys: contact.*, company.*, opportunity.*, organization.*, service.*
 */
export function renderSequenceTemplate(
  template: string,
  vars: Record<string, string | null | undefined>
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key: string) => {
    const value = vars[key];
    return value == null ? "" : String(value);
  });
}

export function buildSequenceTemplateVars(input: {
  contact?: {
    firstName?: string | null;
    lastName?: string | null;
    fullName?: string | null;
    title?: string | null;
    email?: string | null;
  } | null;
  company?: {
    name?: string | null;
    domain?: string | null;
    industry?: string | null;
  } | null;
  opportunity?: {
    whyNow?: string | null;
    likelyProblem?: string | null;
    recommendedAction?: string | null;
    score?: number | null;
  } | null;
  organization?: { name?: string | null } | null;
  service?: { name?: string | null } | null;
}): Record<string, string> {
  const c = input.contact;
  const co = input.company;
  const o = input.opportunity;
  return {
    "contact.firstName": c?.firstName ?? "",
    "contact.lastName": c?.lastName ?? "",
    "contact.fullName": c?.fullName ?? "",
    "contact.title": c?.title ?? "",
    "contact.email": c?.email ?? "",
    "company.name": co?.name ?? "",
    "company.domain": co?.domain ?? "",
    "company.industry": co?.industry ?? "",
    "opportunity.whyNow": o?.whyNow ?? "",
    "opportunity.likelyProblem": o?.likelyProblem ?? "",
    "opportunity.recommendedAction": o?.recommendedAction ?? "",
    "opportunity.score": o?.score != null ? String(o.score) : "",
    "organization.name": input.organization?.name ?? "",
    "service.name": input.service?.name ?? "",
  };
}

/** Compute nextRunAt from now + delayMinutes (UTC). */
export function computeNextRunAt(
  from: Date,
  delayMinutes: number
): Date {
  const ms = Math.max(0, delayMinutes) * 60_000;
  return new Date(from.getTime() + ms);
}

export function enrollmentStepIdempotencyKey(
  enrollmentId: string,
  stepOrder: number
): string {
  return `seq-enroll:${enrollmentId}:step:${stepOrder}`;
}

export const ACTIVE_ENROLLMENT_STATUSES = [
  "PENDING",
  "ACTIVE",
  "PROCESSING",
  "PAUSED",
] as const;

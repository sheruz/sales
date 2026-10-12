/**
 * Sequence template variable rendering (deterministic, no AI).
 * Supports nested keys (contact.firstName) and flat aliases (first_name).
 * Missing values never render as blank or "{{...}}" — fallbacks applied.
 */

export const TEMPLATE_FALLBACKS: Record<string, string> = {
  first_name: "there",
  "contact.firstName": "there",
  company_name: "your team",
  "company.name": "your team",
  personalized_first_line: "I took a look at your website.",
  top_issue: "a few website opportunities",
  recommended_service: "our services",
  short_pitch: "Happy to share a few ideas that may help.",
  city: "your area",
};

/** Vars that should flag a pitch when falling back. */
export const REQUIRED_PITCH_VARS = [
  "first_name",
  "company_name",
  "personalized_first_line",
  "top_issue",
  "recommended_service",
  "short_pitch",
] as const;

export type RenderTemplateResult = {
  text: string;
  missingRequired: string[];
};

function resolveVar(
  key: string,
  vars: Record<string, string | null | undefined>
): { value: string; usedFallback: boolean } {
  const direct = vars[key];
  if (direct != null && String(direct).trim() !== "") {
    return { value: String(direct), usedFallback: false };
  }
  const fb = TEMPLATE_FALLBACKS[key];
  if (fb != null) {
    return { value: fb, usedFallback: true };
  }
  // Unknown keys: use a short placeholder word, never "{{key}}"
  return { value: "—", usedFallback: true };
}

export function renderSequenceTemplate(
  template: string,
  vars: Record<string, string | null | undefined>
): string {
  return renderSequenceTemplateDetailed(template, vars).text;
}

export function renderSequenceTemplateDetailed(
  template: string,
  vars: Record<string, string | null | undefined>,
  requiredKeys: readonly string[] = REQUIRED_PITCH_VARS
): RenderTemplateResult {
  const missingRequired: string[] = [];
  const text = template.replace(
    /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g,
    (_, key: string) => {
      const { value, usedFallback } = resolveVar(key, vars);
      if (usedFallback && requiredKeys.includes(key)) {
        if (!missingRequired.includes(key)) missingRequired.push(key);
      }
      return value;
    }
  );
  return { text, missingRequired };
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
    city?: string | null;
  } | null;
  opportunity?: {
    whyNow?: string | null;
    likelyProblem?: string | null;
    recommendedAction?: string | null;
    score?: number | null;
  } | null;
  organization?: { name?: string | null } | null;
  service?: { name?: string | null } | null;
  pitch?: {
    personalizedFirstLine?: string | null;
    shortPitch?: string | null;
    topIssue?: string | null;
    recommendedService?: string | null;
  } | null;
}): Record<string, string> {
  const c = input.contact;
  const co = input.company;
  const o = input.opportunity;
  const p = input.pitch;

  const firstName = c?.firstName?.trim() || "";
  const companyName = co?.name?.trim() || "";
  const city = co?.city?.trim() || "";
  const firstLine = p?.personalizedFirstLine?.trim() || "";
  const topIssue = p?.topIssue?.trim() || "";
  const recommendedService =
    p?.recommendedService?.trim() || input.service?.name?.trim() || "";
  const shortPitch = p?.shortPitch?.trim() || "";

  return {
    // Nested (legacy)
    "contact.firstName": firstName,
    "contact.lastName": c?.lastName ?? "",
    "contact.fullName": c?.fullName ?? "",
    "contact.title": c?.title ?? "",
    "contact.email": c?.email ?? "",
    "company.name": companyName,
    "company.domain": co?.domain ?? "",
    "company.industry": co?.industry ?? "",
    "company.city": city,
    "opportunity.whyNow": o?.whyNow ?? "",
    "opportunity.likelyProblem": o?.likelyProblem ?? "",
    "opportunity.recommendedAction": o?.recommendedAction ?? "",
    "opportunity.score": o?.score != null ? String(o.score) : "",
    "organization.name": input.organization?.name ?? "",
    "service.name": input.service?.name ?? "",
    // Flat aliases (Phase 3)
    first_name: firstName,
    company_name: companyName,
    city,
    personalized_first_line: firstLine,
    top_issue: topIssue,
    recommended_service: recommendedService,
    short_pitch: shortPitch,
  };
}

/** Compute nextRunAt from now + delayMinutes (UTC). */
export function computeNextRunAt(from: Date, delayMinutes: number): Date {
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

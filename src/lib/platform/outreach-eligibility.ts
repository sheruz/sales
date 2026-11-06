/**
 * Pure eligibility helpers for Super Admin Outreach (Default Workspace).
 * Cooldown + active enrollment span PoW, tenant campaigns, and platform campaigns.
 */

import { ACTIVE_ENROLLMENT_STATUSES } from "@/lib/sequences/runtime";
import { isOutreachExcluded } from "@/lib/crm/import/outreach-exclude";
import { isCanadianContact } from "@/lib/pow/casl";
import { resolveOutboundTimezone } from "@/lib/outbound/timezone";

export const OUTREACH_COOLDOWN_DAYS = 30;

export type EligibilitySkipReason =
  | "no_email"
  | "suppressed"
  | "client_or_dnc"
  | "active_enrollment"
  | "cooldown_30d"
  | "casl_unpublished"
  | "missing_business_address"
  | "outreach_send_disabled"
  | "campaign_paused"
  | "campaign_cap"
  | "daily_limit";

export function hasWebsite(company: {
  website?: string | null;
  domain?: string | null;
}): boolean {
  const w = (company.website || "").trim();
  const d = (company.domain || "").trim();
  if (w && !/^https?:\/\/\s*$/i.test(w)) return true;
  if (d && d.includes(".")) return true;
  return false;
}

/** first_name empty → "Hi {company} team" (fill first_name token). */
export function platformFirstNameToken(
  firstName: string | null | undefined,
  companyName: string | null | undefined
): string {
  const fn = (firstName || "").trim();
  if (fn && fn.toLowerCase() !== "general") return fn;
  const co = (companyName || "").trim();
  return co ? `${co} team` : "there";
}

export function assertBusinessAddress(address: string | null | undefined): {
  ok: boolean;
  reason?: EligibilitySkipReason;
  message?: string;
} {
  if (!address?.trim()) {
    return {
      ok: false,
      reason: "missing_business_address",
      message:
        "Set business address in Default Workspace Outbound / Email branding before sending. {{business_address}} cannot be empty.",
    };
  }
  return { ok: true };
}

export function caslBlocksCanadian(opts: {
  emailSource?: string | null;
  companyCountry?: string | null;
  metadata?: unknown;
}): boolean {
  if (
    !isCanadianContact({
      companyCountry: opts.companyCountry,
      metadata: opts.metadata,
    })
  ) {
    return false;
  }
  return String(opts.emailSource || "").toLowerCase() !== "published";
}

export function excludedAsClientOrDnc(input: {
  companyMetadata?: unknown;
  contactMetadata?: unknown;
  contactStatus?: string | null;
}): boolean {
  return isOutreachExcluded(input);
}

export function isActiveEnrollmentStatus(status: string): boolean {
  return (ACTIVE_ENROLLMENT_STATUSES as readonly string[]).includes(status);
}

export function cooldownCutoff(now = new Date()): Date {
  return new Date(
    now.getTime() - OUTREACH_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
  );
}

/** City/company TZ → country → US Eastern (never UTC for platform outreach). */
export function resolvePlatformOutreachTimezone(input: {
  timezone?: string | null;
  city?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
}): string {
  const resolved = resolveOutboundTimezone({
    timezone: input.timezone,
    country: input.country,
    lat: input.lat,
    lng: input.lng,
    fallbackTimezone: "America/New_York",
  });
  if (resolved.from === "utc") return "America/New_York";
  return resolved.timezone;
}

export function fillPlatformTemplate(opts: {
  template: string;
  firstName?: string | null;
  companyName?: string | null;
  website?: string | null;
  city?: string | null;
  businessAddress?: string | null;
  originalSubject?: string | null;
}): string {
  const vars: Record<string, string> = {
    first_name: platformFirstNameToken(opts.firstName, opts.companyName),
    company_name: (opts.companyName || "").trim() || "your team",
    website: (opts.website || "").trim() || "your website",
    city: (opts.city || "").trim() || "your area",
    business_address: (opts.businessAddress || "").trim(),
    original_subject: (opts.originalSubject || "").trim() || "our last email",
  };
  return opts.template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key) => {
    return vars[key] ?? "—";
  });
}

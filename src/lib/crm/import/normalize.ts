import type { CrmImportRelationship } from "@/lib/crm/import/types";
import { countryTimezoneHint } from "@/lib/outbound/timezone";

const COUNTRY_CANONICAL: Record<string, string> = {
  ca: "CA",
  canada: "CA",
  us: "US",
  usa: "US",
  "united states": "US",
  "united states of america": "US",
  gb: "GB",
  uk: "GB",
  "united kingdom": "GB",
  "great britain": "GB",
  au: "AU",
  australia: "AU",
  pk: "PK",
  pakistan: "PK",
  in: "IN",
  india: "IN",
  ae: "AE",
  uae: "AE",
  "united arab emirates": "AE",
  de: "DE",
  germany: "DE",
  fr: "FR",
  france: "FR",
  nl: "NL",
  netherlands: "NL",
  sg: "SG",
  singapore: "SG",
  nz: "NZ",
  "new zealand": "NZ",
};

/** Normalize country to ISO-ish code when known (Canada/CA → CA). */
export function normalizeCountry(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const key = raw.trim().toLowerCase();
  if (COUNTRY_CANONICAL[key]) return COUNTRY_CANONICAL[key];
  // Already a 2-letter code
  if (/^[a-z]{2}$/i.test(raw.trim())) return raw.trim().toUpperCase();
  return raw.trim();
}

export function splitTags(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(";")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function parseYesNo(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return false;
  const v = raw.trim().toLowerCase();
  return ["yes", "y", "true", "1", "do_not_contact", "dnc"].includes(v);
}

export function normalizeRelationship(
  raw: string | null | undefined
): CrmImportRelationship {
  if (!raw?.trim()) return "";
  const v = raw.trim().toLowerCase().replace(/[\s\-]+/g, "_");
  if (v === "client" || v === "customer") return "client";
  if (v === "past_client" || v === "pastclient" || v === "former_client") {
    return "past_client";
  }
  if (v === "partner") return "partner";
  if (v === "prospect" || v === "lead") return "prospect";
  return "";
}

export function isCustomerRelationship(rel: CrmImportRelationship): boolean {
  return rel === "client" || rel === "past_client" || rel === "partner";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailFormat(email: string | null | undefined): boolean {
  if (!email?.trim()) return false;
  return EMAIL_RE.test(email.trim());
}

export function parseEmployeeCount(raw: string | null | undefined): number | null {
  if (!raw?.trim()) return null;
  const n = Number(String(raw).replace(/[, ]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

/** Timezone from city/country — country hint; city used as soft override for known metros. */
const CITY_TZ: Record<string, string> = {
  toronto: "America/Toronto",
  vancouver: "America/Vancouver",
  montreal: "America/Toronto",
  calgary: "America/Edmonton",
  "new york": "America/New_York",
  "los angeles": "America/Los_Angeles",
  chicago: "America/Chicago",
  london: "Europe/London",
  karachi: "Asia/Karachi",
  lahore: "Asia/Karachi",
  dubai: "Asia/Dubai",
  sydney: "Australia/Sydney",
};

export function deriveImportTimezone(input: {
  city?: string | null;
  country?: string | null;
}): string | null {
  const city = input.city?.trim().toLowerCase();
  if (city && CITY_TZ[city]) return CITY_TZ[city];
  return countryTimezoneHint(input.country);
}

/** Fill only empty target fields; never overwrite filled ones. */
export function fillEmptyFields<T extends Record<string, unknown>>(
  existing: T,
  incoming: Partial<T>,
  keys: (keyof T)[]
): { patch: Partial<T>; filled: string[] } {
  const patch: Partial<T> = {};
  const filled: string[] = [];
  for (const key of keys) {
    const cur = existing[key];
    const next = incoming[key];
    const empty =
      cur == null ||
      cur === "" ||
      (Array.isArray(cur) && cur.length === 0);
    if (!empty) continue;
    if (next == null || next === "") continue;
    patch[key] = next as T[keyof T];
    filled.push(String(key));
  }
  return { patch, filled };
}

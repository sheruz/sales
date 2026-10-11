import { extractDomain, normalizeDomain } from "@/services/company.service";

export type PlaceCompanyInput = {
  googlePlaceId: string;
  name: string;
  website?: string | null;
  phone?: string | null;
  address?: string | null;
  country?: string | null;
  city?: string | null;
};

export type DedupeMatch =
  | { kind: "place_id"; companyId: string }
  | { kind: "domain"; companyId: string }
  | { kind: "none" };

/**
 * Decide how to match an incoming Places result against existing companies.
 * Pure helper — callers pass lookup results.
 */
export function resolveCompanyDedupe(input: {
  byPlaceId: { id: string } | null;
  byDomain: { id: string } | null;
}): DedupeMatch {
  if (input.byPlaceId) {
    return { kind: "place_id", companyId: input.byPlaceId.id };
  }
  if (input.byDomain) {
    return { kind: "domain", companyId: input.byDomain.id };
  }
  return { kind: "none" };
}

export function domainFromPlaceWebsite(
  website?: string | null
): string | null {
  return normalizeDomain(extractDomain(website) || website);
}

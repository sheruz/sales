/**
 * ICP fit scoring for PoW deep audits.
 * Low fit → skip Playwright spend (no audit_deep credit charge).
 */

export type IcpFitBand = "high" | "medium" | "low";

export type IcpFitInput = {
  companyIndustry?: string | null;
  companyCity?: string | null;
  companyCountry?: string | null;
  companyEmployeeCount?: number | null;
  companySize?: string | null;
  /** From business brain ICPs */
  icpIndustries: string[];
  icpGeographies?: string[];
  icpEmployeeRanges?: string[];
  /** Optional Places rating (transient — not persisted as review text) */
  placesRating?: number | null;
  placesReviewCount?: number | null;
};

export type IcpFitResult = {
  band: IcpFitBand;
  score: number;
  reasons: string[];
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function industryOverlap(
  companyIndustry: string | null | undefined,
  icpIndustries: string[]
): number {
  if (!companyIndustry || !icpIndustries.length) return 0;
  const c = norm(companyIndustry);
  let best = 0;
  for (const raw of icpIndustries) {
    const i = norm(raw);
    if (!i) continue;
    if (c === i || c.includes(i) || i.includes(c)) best = Math.max(best, 40);
    else {
      const ct = new Set(c.split(/[\s,/|&]+/).filter(Boolean));
      const it = i.split(/[\s,/|&]+/).filter(Boolean);
      const hits = it.filter((t) => ct.has(t) || [...ct].some((x) => x.includes(t) || t.includes(x)));
      if (hits.length) best = Math.max(best, Math.min(35, 10 * hits.length));
    }
  }
  return best;
}

function geoOverlap(
  city: string | null | undefined,
  country: string | null | undefined,
  geos: string[]
): number {
  if (!geos.length) return 10; // no geo constraint → neutral credit
  const blob = [city, country].filter(Boolean).map((s) => norm(s!)).join(" ");
  if (!blob) return 0;
  for (const g of geos) {
    const n = norm(g);
    if (n && blob.includes(n)) return 25;
  }
  return 0;
}

function sizeScore(
  employeeCount: number | null | undefined,
  size: string | null | undefined,
  ranges: string[]
): number {
  if (!ranges.length) return 10;
  const label = (size || "").toLowerCase();
  const n = employeeCount ?? null;
  for (const r of ranges) {
    const rr = r.toLowerCase();
    if (label && (label.includes(rr) || rr.includes(label))) return 15;
    const m = rr.match(/(\d+)\s*[-–to]+\s*(\d+)/);
    if (m && n != null) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      if (n >= a && n <= b) return 15;
    }
    if (/solo|1[-–]10|small/.test(rr) && n != null && n <= 10) return 15;
  }
  return 0;
}

function placesSignal(
  rating: number | null | undefined,
  count: number | null | undefined
): number {
  // Transient signals only — never persist review text
  if (rating == null) return 0;
  let s = 0;
  if (rating >= 3.5 && rating < 4.6) s += 8; // room to improve
  if (count != null && count >= 5 && count < 80) s += 5;
  return s;
}

export function scoreIcpFit(input: IcpFitInput): IcpFitResult {
  const reasons: string[] = [];
  let score = 0;

  const ind = industryOverlap(input.companyIndustry, input.icpIndustries);
  score += ind;
  if (ind >= 30) reasons.push("industry_match");
  else if (ind > 0) reasons.push("industry_partial");
  else if (input.icpIndustries.length) reasons.push("industry_miss");

  const geo = geoOverlap(
    input.companyCity,
    input.companyCountry,
    input.icpGeographies ?? []
  );
  score += geo;
  if (geo >= 20) reasons.push("geo_match");

  const size = sizeScore(
    input.companyEmployeeCount,
    input.companySize,
    input.icpEmployeeRanges ?? []
  );
  score += size;

  const places = placesSignal(input.placesRating, input.placesReviewCount);
  score += places;
  if (places > 0) reasons.push("places_signal");

  // No ICP configured → allow medium (don't block audits during setup)
  if (!input.icpIndustries.length) {
    score = Math.max(score, 45);
    reasons.push("no_icp_configured");
  }

  let band: IcpFitBand = "low";
  if (score >= 55) band = "high";
  else if (score >= 35) band = "medium";

  return { band, score: Math.min(100, score), reasons };
}

export function shouldSkipDeepAudit(fit: IcpFitResult): boolean {
  return fit.band === "low";
}

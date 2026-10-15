/** Normalize country strings for allow-list matching. */
export function normalizeCountry(raw: string | null | undefined): string {
  return (raw || "").trim().toUpperCase().replace(/\./g, "");
}

const US_ALIASES = new Set([
  "US",
  "USA",
  "UNITED STATES",
  "UNITED STATES OF AMERICA",
  "U S",
  "U S A",
]);

/** Default stays US-focused for cold outreach safety. Use ["*"] to allow all. */
export const DEFAULT_COUNTRY_ALLOW_LIST = ["US", "USA", "United States"];

export const ALLOW_ALL_COUNTRIES = ["*"];

export function isAllowAllCountries(allowList: string[]): boolean {
  const allowed = allowList.map(normalizeCountry).filter(Boolean);
  if (!allowed.length) return true; // empty list = no restriction
  return allowed.some((a) => a === "*" || a === "ALL" || a === "ANY");
}

export function isCountryAllowed(
  country: string | null | undefined,
  allowList: string[]
): boolean {
  // Explicit allow-all (or empty list): never block on country
  if (isAllowAllCountries(allowList)) return true;

  const c = normalizeCountry(country);
  if (!c) return false;
  const allowed = allowList.map(normalizeCountry).filter(Boolean);

  for (const a of allowed) {
    if (c === a) return true;
    if (US_ALIASES.has(c) && US_ALIASES.has(a)) return true;
    if (c.includes(a) || a.includes(c)) return true;
  }
  return false;
}

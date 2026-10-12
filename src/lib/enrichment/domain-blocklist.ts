export const DEFAULT_DOMAIN_BLOCKLIST: string[] = [
  "zillow.com",
  "realtor.com",
  "redfin.com",
  "trulia.com",
  "facebook.com",
  "linkedin.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "google.com",
  "yelp.com",
  "yellowpages.com",
  "bbb.org",
  "craigslist.org",
  "apartments.com",
  "loopnet.com",
  "kw.com",
];

/** True if host is blocked, including subdomains (e.g. foo.kw.com). */
export function isDomainBlocked(
  domain: string | null | undefined,
  blocklist: string[] = DEFAULT_DOMAIN_BLOCKLIST
): boolean {
  if (!domain) return true;
  const host = domain
    .toLowerCase()
    .trim()
    .replace(/^www\./, "");
  if (!host) return true;
  return blocklist.some((blocked) => {
    const b = blocked.toLowerCase().trim().replace(/^www\./, "");
    return host === b || host.endsWith(`.${b}`);
  });
}

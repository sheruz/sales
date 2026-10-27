/**
 * CASL: Canadian contacts may only be enrolled in PoW with emailSource = published.
 */

const CA_RE = /^(ca|can|canada)$/i;

export function isCanadianContact(opts: {
  contactCountry?: string | null;
  companyCountry?: string | null;
  metadata?: unknown;
}): boolean {
  const meta =
    opts.metadata &&
    typeof opts.metadata === "object" &&
    !Array.isArray(opts.metadata)
      ? (opts.metadata as Record<string, unknown>)
      : null;
  const metaCountry =
    typeof meta?.country === "string"
      ? meta.country
      : typeof meta?.countryCode === "string"
        ? meta.countryCode
        : null;
  for (const c of [opts.contactCountry, opts.companyCountry, metaCountry]) {
    if (c && CA_RE.test(c.trim())) return true;
  }
  return false;
}

export function assertCaslPowEnroll(opts: {
  emailSource?: string | null;
  contactCountry?: string | null;
  companyCountry?: string | null;
  metadata?: unknown;
}): void {
  if (!isCanadianContact(opts)) return;
  if (String(opts.emailSource || "").toLowerCase() !== "published") {
    throw new Error(
      "CASL: Canadian contacts require emailSource=published to enroll in Proof of Work"
    );
  }
}

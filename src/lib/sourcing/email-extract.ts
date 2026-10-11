/** Pure email extraction + junk filtering for website crawls. */

const EMAIL_RE =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const JUNK_LOCAL = new Set([
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "example",
  "email",
  "name",
  "user",
  "test",
  "mailto",
  "sentry",
  "webpack",
  "wix",
]);

const JUNK_DOMAIN = new Set([
  "example.com",
  "example.org",
  "domain.com",
  "email.com",
  "yoursite.com",
  "sentry.io",
  "wixpress.com",
  "schema.org",
]);

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|ico|bmp|tiff?)($|\?)/i;

export function classifyEmailType(
  email: string
): "GENERIC" | "PERSONAL" {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (
    /^(info|contact|hello|support|sales|admin|office|enquiries|inquiry|mail|team|help|booking|appointments?)$/i.test(
      local
    )
  ) {
    return "GENERIC";
  }
  return "PERSONAL";
}

export function isJunkEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return true;
  if (IMAGE_EXT.test(normalized)) return true;
  if (normalized.includes("...") || normalized.includes("@@")) return true;

  const [local, domain] = normalized.split("@");
  if (!local || !domain) return true;
  if (local.length < 2 || domain.length < 3) return true;
  if (JUNK_LOCAL.has(local)) return true;
  if (JUNK_DOMAIN.has(domain)) return true;
  if (domain.endsWith(".png") || domain.endsWith(".jpg")) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) return true;
  return false;
}

export function extractEmailsFromText(text: string): string[] {
  if (!text) return [];
  const found = text.match(EMAIL_RE) ?? [];
  const unique = new Set<string>();
  for (const raw of found) {
    const email = raw.toLowerCase().replace(/[>,;]+$/, "");
    if (isJunkEmail(email)) continue;
    unique.add(email);
  }
  return [...unique];
}

export function extractSocialLinks(html: string): {
  linkedInUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
} {
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]);
  let linkedInUrl: string | null = null;
  let facebookUrl: string | null = null;
  let instagramUrl: string | null = null;
  for (const href of hrefs) {
    const lower = href.toLowerCase();
    if (!linkedInUrl && lower.includes("linkedin.com/")) linkedInUrl = href;
    if (
      !facebookUrl &&
      (lower.includes("facebook.com/") || lower.includes("fb.com/"))
    ) {
      facebookUrl = href;
    }
    if (!instagramUrl && lower.includes("instagram.com/")) instagramUrl = href;
  }
  return { linkedInUrl, facebookUrl, instagramUrl };
}

export function extractPhonesFromText(text: string): string[] {
  const matches =
    text.match(
      /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3}[\s.-]?\d{3,4}[\s.-]?\d{0,4}/g
    ) ?? [];
  const out = new Set<string>();
  for (const m of matches) {
    const digits = m.replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 15) out.add(m.trim());
  }
  return [...out].slice(0, 5);
}

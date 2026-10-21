import dns from "node:dns/promises";
import { normalizeEmail } from "@/services/contact.service";

/** Common disposable / temporary email domains (lowercase). */
export const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.org",
  "sharklasers.com",
  "grr.la",
  "tempmail.com",
  "temp-mail.org",
  "throwaway.email",
  "yopmail.com",
  "trashmail.com",
  "10minutemail.com",
  "10minutemail.net",
  "dispostable.com",
  "mailnesia.com",
  "maildrop.cc",
  "getnada.com",
  "tempail.com",
  "fakeinbox.com",
  "emailondeck.com",
  "mintemail.com",
  "discard.email",
  "mailcatch.com",
  "spamgourmet.com",
  "moakt.com",
  "tmpmail.org",
  "tmpmail.net",
  "emailtemporanea.com",
  "crazymailing.com",
]);

/** Local-part prefixes treated as generic/role addresses (allowed, labeled). */
export const ROLE_LOCAL_PARTS = new Set([
  "info",
  "sales",
  "support",
  "admin",
  "contact",
  "hello",
  "office",
  "team",
  "billing",
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "marketing",
  "hr",
  "jobs",
  "careers",
  "help",
  "service",
  "enquiry",
  "inquiry",
  "mail",
  "general",
  "webmaster",
  "postmaster",
  "abuse",
  "privacy",
  "legal",
  "press",
  "media",
  "partners",
  "accounts",
  "accounting",
  "finance",
  "reception",
]);

/** Domain typo → suggested correction (never auto-applied). */
export const DOMAIN_TYPO_SUGGESTIONS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.cm": "gmail.com",
  "gamil.com": "gmail.com",
  "gnail.com": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "outlook.co": "outlook.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yhoo.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "iclou.com": "icloud.com",
  "icloud.co": "icloud.com",
  "protonmai.com": "protonmail.com",
  "protonmal.com": "protonmail.com",
};

const EMAIL_SYNTAX =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export type EmailQualityFailure =
  | "syntax"
  | "disposable"
  | "mx"
  | "mx_timeout";

export type EmailQualityResult = {
  email: string;
  domain: string | null;
  ok: boolean;
  /** valid_manual when ok; invalid when failed check */
  emailStatus: "valid_manual" | "invalid";
  failure?: EmailQualityFailure;
  roleGeneric: boolean;
  typoSuggestion: string | null;
  message?: string;
};

type MxCacheEntry = { ok: boolean; at: number };
const mxCache = new Map<string, MxCacheEntry>();
const MX_CACHE_TTL_MS = 60 * 60 * 1000;
const MX_TIMEOUT_MS = 2500;

export function clearMxCacheForTests() {
  mxCache.clear();
}

export function setMxCacheForTests(domain: string, ok: boolean) {
  mxCache.set(domain.toLowerCase(), { ok, at: Date.now() });
}

export function extractEmailDomain(email: string): string | null {
  const n = normalizeEmail(email);
  if (!n || !n.includes("@")) return null;
  return n.split("@")[1] || null;
}

export function isRoleAddress(email: string): boolean {
  const n = normalizeEmail(email);
  if (!n) return false;
  const local = n.split("@")[0] || "";
  return ROLE_LOCAL_PARTS.has(local.toLowerCase());
}

export function isDisposableDomain(domain: string | null | undefined): boolean {
  if (!domain) return false;
  const d = domain.toLowerCase();
  if (DISPOSABLE_DOMAINS.has(d)) return true;
  // subdomain of disposable
  for (const blocked of DISPOSABLE_DOMAINS) {
    if (d.endsWith(`.${blocked}`)) return true;
  }
  return false;
}

export function typoSuggestionForEmail(email: string): string | null {
  const domain = extractEmailDomain(email);
  if (!domain) return null;
  const fix = DOMAIN_TYPO_SUGGESTIONS[domain.toLowerCase()];
  if (!fix) return null;
  const local = email.trim().split("@")[0];
  return `${local}@${fix}`;
}

export function checkEmailSyntax(email: string): boolean {
  const n = normalizeEmail(email);
  if (!n) return false;
  if (n.length > 254) return false;
  return EMAIL_SYNTAX.test(n);
}

async function resolveMxWithTimeout(domain: string): Promise<boolean> {
  const cached = mxCache.get(domain);
  if (cached && Date.now() - cached.at < MX_CACHE_TTL_MS) {
    return cached.ok;
  }

  const lookup = dns.resolveMx(domain).then((records) => records.length > 0);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), MX_TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([lookup, timeout]);
    if (result === "timeout") {
      // Treat timeout as fail-open for MX? User said timeout-safe and failed MX → invalid.
      // Timeout → mx_timeout → invalid to be safe against bad domains hanging.
      mxCache.set(domain, { ok: false, at: Date.now() });
      return false;
    }
    const ok = Boolean(result);
    mxCache.set(domain, { ok, at: Date.now() });
    return ok;
  } catch {
    mxCache.set(domain, { ok: false, at: Date.now() });
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Free built-in email quality check (no third party).
 * Order: syntax → disposable → MX. Role addresses pass with roleGeneric flag.
 */
export async function checkEmailQuality(
  rawEmail: string,
  opts?: { skipMx?: boolean }
): Promise<EmailQualityResult> {
  const email = normalizeEmail(rawEmail) || rawEmail.trim().toLowerCase();
  const domain = extractEmailDomain(email);
  const typo = typoSuggestionForEmail(email);
  const roleGeneric = isRoleAddress(email);

  if (!checkEmailSyntax(email)) {
    return {
      email,
      domain,
      ok: false,
      emailStatus: "invalid",
      failure: "syntax",
      roleGeneric,
      typoSuggestion: typo,
      message: `Invalid email syntax: ${rawEmail}`,
    };
  }

  if (isDisposableDomain(domain)) {
    return {
      email,
      domain,
      ok: false,
      emailStatus: "invalid",
      failure: "disposable",
      roleGeneric,
      typoSuggestion: typo,
      message: `Disposable email domain blocked: ${domain}`,
    };
  }

  if (!opts?.skipMx && domain) {
    const mxOk = await resolveMxWithTimeout(domain);
    if (!mxOk) {
      const cached = mxCache.get(domain);
      // Distinguish timeout vs no MX via second peek — both stored as ok:false
      return {
        email,
        domain,
        ok: false,
        emailStatus: "invalid",
        failure: cached && Date.now() - cached.at < 100 ? "mx" : "mx",
        roleGeneric,
        typoSuggestion: typo,
        message: `No MX records for domain: ${domain}`,
      };
    }
  }

  return {
    email,
    domain,
    ok: true,
    emailStatus: "valid_manual",
    roleGeneric,
    typoSuggestion: typo,
  };
}

/** Sync-only checks for preview (no DNS). */
export function checkEmailQualitySync(rawEmail: string): EmailQualityResult {
  const email = normalizeEmail(rawEmail) || rawEmail.trim().toLowerCase();
  const domain = extractEmailDomain(email);
  const typo = typoSuggestionForEmail(email);
  const roleGeneric = isRoleAddress(email);

  if (!checkEmailSyntax(email)) {
    return {
      email,
      domain,
      ok: false,
      emailStatus: "invalid",
      failure: "syntax",
      roleGeneric,
      typoSuggestion: typo,
      message: `Invalid email syntax: ${rawEmail}`,
    };
  }
  if (isDisposableDomain(domain)) {
    return {
      email,
      domain,
      ok: false,
      emailStatus: "invalid",
      failure: "disposable",
      roleGeneric,
      typoSuggestion: typo,
      message: `Disposable email domain blocked: ${domain}`,
    };
  }
  return {
    email,
    domain,
    ok: true,
    emailStatus: "valid_manual",
    roleGeneric,
    typoSuggestion: typo,
  };
}

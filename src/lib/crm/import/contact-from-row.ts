import {
  extractEmailDomain,
  isRoleAddress,
  ROLE_LOCAL_PARTS,
} from "@/lib/crm/import/email-quality";
import { extractDomain, normalizeDomain } from "@/services/company.service";
import { normalizeEmail } from "@/services/contact.service";

/** company_email must not become a contact when local-part is one of these. */
export const COMPANY_EMAIL_BLOCKED_LOCALS = new Set([
  "careers",
  "jobs",
  "hr",
  "talent",
  "hiring",
  "press",
  "privacy",
  "helpdesk",
]);

/** Role locals that display as "General inbox" (info@, hello@, studio@, …). */
export const GENERAL_INBOX_ROLE_LOCALS = new Set([
  "info",
  "hello",
  "studio",
  "office",
  "contact",
  "admin",
  "support",
  "sales",
  "team",
  "mail",
  "general",
  "reception",
  ...ROLE_LOCAL_PARTS,
]);

export const GENERAL_INBOX_TITLE = "General inbox";
export const GENERAL_INBOX_FIRST = "General";
export const GENERAL_INBOX_LAST = "inbox";

export function emailLocalPart(email: string): string {
  const n = normalizeEmail(email) || email.trim().toLowerCase();
  return (n.split("@")[0] || "").toLowerCase();
}

export function isBlockedCompanyEmail(email: string): boolean {
  const local = emailLocalPart(email);
  const base = local.split(/[._+-]/)[0] ?? local;
  return (
    COMPANY_EMAIL_BLOCKED_LOCALS.has(local) ||
    COMPANY_EMAIL_BLOCKED_LOCALS.has(base)
  );
}

export function isGeneralInboxRoleEmail(email: string): boolean {
  const local = emailLocalPart(email);
  const base = local.split(/[._+-]/)[0] ?? local;
  return (
    GENERAL_INBOX_ROLE_LOCALS.has(local) ||
    GENERAL_INBOX_ROLE_LOCALS.has(base) ||
    isRoleAddress(email)
  );
}

/**
 * Email domain must match company website/domain (exact host match after normalize).
 * No website/domain → cannot verify → not a match.
 */
export function emailMatchesCompanyDomain(
  email: string,
  websiteOrDomain: string | null | undefined
): boolean {
  const emailDomain = extractEmailDomain(email);
  const companyDomain =
    normalizeDomain(websiteOrDomain) || extractDomain(websiteOrDomain);
  if (!emailDomain || !companyDomain) return false;
  if (emailDomain === companyDomain) return true;
  // Allow mail.acme.com vs acme.com
  if (emailDomain.endsWith(`.${companyDomain}`)) return true;
  return false;
}

export type ResolvedImportContact = {
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  title: string | null;
  /** true when we synthesized General inbox from role/company_email */
  isGeneralInbox: boolean;
  /** source of the email used */
  emailSource: "email" | "company_email";
};

export type ResolveContactResult =
  | { ok: true; contact: ResolvedImportContact }
  | {
      ok: false;
      code:
        | "no_email"
        | "domain_mismatch"
        | "company_email_blocked"
        | "no_company_domain";
      message: string;
    };

/**
 * Resolve who to create as a contact from a CSV row.
 * - email + optional names
 * - else company_email (if not careers-style blocked) → General inbox
 */
export function resolveImportContact(input: {
  email?: string | null;
  companyEmail?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  title?: string | null;
  website?: string | null;
  companyDomain?: string | null;
}): ResolveContactResult {
  const websiteOrDomain = input.website || input.companyDomain;
  const companyDomain =
    normalizeDomain(websiteOrDomain) || extractDomain(websiteOrDomain);

  const personEmail = normalizeEmail(input.email);
  const companyEmail = normalizeEmail(input.companyEmail);
  const first = (input.firstName || "").trim();
  const last = (input.lastName || "").trim();
  const titleRaw = (input.title || "").trim();
  const titleIsGeneral =
    titleRaw.toLowerCase() === GENERAL_INBOX_TITLE.toLowerCase();

  const tryBuild = (
    email: string,
    emailSource: "email" | "company_email"
  ): ResolveContactResult => {
    if (!companyDomain) {
      return {
        ok: false,
        code: "no_company_domain",
        message: `Cannot verify email domain (no company website/domain): ${email}`,
      };
    }
    if (!emailMatchesCompanyDomain(email, companyDomain)) {
      return {
        ok: false,
        code: "domain_mismatch",
        message: `Email domain does not match company website (${companyDomain}): ${email}`,
      };
    }

    const roleGeneral =
      emailSource === "company_email" ||
      titleIsGeneral ||
      isGeneralInboxRoleEmail(email);

    if (roleGeneral || (!first && !last)) {
      if (roleGeneral || titleIsGeneral || isGeneralInboxRoleEmail(email)) {
        return {
          ok: true,
          contact: {
            email,
            firstName: GENERAL_INBOX_FIRST,
            lastName: GENERAL_INBOX_LAST,
            fullName: GENERAL_INBOX_TITLE,
            title: titleRaw || GENERAL_INBOX_TITLE,
            isGeneralInbox: true,
            emailSource,
          },
        };
      }
      // Email-only, personal local-part — display as email; first_name empty → "there"
      return {
        ok: true,
        contact: {
          email,
          firstName: "",
          lastName: "",
          fullName: email,
          title: titleRaw || null,
          isGeneralInbox: false,
          emailSource,
        },
      };
    }

    // Named contact
    return {
      ok: true,
      contact: {
        email,
        firstName: first,
        lastName: last || "",
        fullName: `${first} ${last}`.trim() || email,
        title: titleRaw || null,
        isGeneralInbox: titleIsGeneral,
        emailSource,
      },
    };
  };

  if (personEmail) {
    if (!companyDomain) {
      return {
        ok: false,
        code: "no_company_domain",
        message: `Cannot verify email domain (no company website/domain): ${personEmail}`,
      };
    }
    if (!emailMatchesCompanyDomain(personEmail, companyDomain)) {
      return {
        ok: false,
        code: "domain_mismatch",
        message: `Email domain does not match company website (${companyDomain}): ${personEmail}`,
      };
    }

    // Named person (first and/or last present)
    if (first || last) {
      const asGeneral = titleIsGeneral;
      return {
        ok: true,
        contact: {
          email: personEmail,
          firstName: asGeneral ? GENERAL_INBOX_FIRST : first,
          lastName: asGeneral ? GENERAL_INBOX_LAST : last,
          fullName: asGeneral
            ? GENERAL_INBOX_TITLE
            : `${first} ${last}`.trim(),
          title: asGeneral ? GENERAL_INBOX_TITLE : titleRaw || null,
          isGeneralInbox: asGeneral,
          emailSource: "email",
        },
      };
    }

    // Email-only (no names)
    return tryBuild(personEmail, "email");
  }

  if (companyEmail) {
    if (isBlockedCompanyEmail(companyEmail)) {
      return {
        ok: false,
        code: "company_email_blocked",
        message: `company_email blocked for contact creation (${emailLocalPart(companyEmail)}@): ${companyEmail}`,
      };
    }
    // Always General inbox from company_email
    if (!companyDomain) {
      return {
        ok: false,
        code: "no_company_domain",
        message: `Cannot verify email domain (no company website/domain): ${companyEmail}`,
      };
    }
    if (!emailMatchesCompanyDomain(companyEmail, companyDomain)) {
      return {
        ok: false,
        code: "domain_mismatch",
        message: `company_email domain does not match company website (${companyDomain}): ${companyEmail}`,
      };
    }
    return {
      ok: true,
      contact: {
        email: companyEmail,
        firstName: GENERAL_INBOX_FIRST,
        lastName: GENERAL_INBOX_LAST,
        fullName: GENERAL_INBOX_TITLE,
        title: GENERAL_INBOX_TITLE,
        isGeneralInbox: true,
        emailSource: "company_email",
      },
    };
  }

  return { ok: false, code: "no_email", message: "No email or company_email" };
}

/** Display label for UI lists. */
export function contactDisplayName(input: {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  title?: string | null;
  email?: string | null;
}): string {
  const title = (input.title || "").trim();
  if (title.toLowerCase() === GENERAL_INBOX_TITLE.toLowerCase()) {
    return GENERAL_INBOX_TITLE;
  }
  if (input.email && isGeneralInboxRoleEmail(input.email)) {
    return GENERAL_INBOX_TITLE;
  }
  const full = (input.fullName || "").trim();
  if (full) return full;
  const named = `${input.firstName || ""} ${input.lastName || ""}`.trim();
  if (named) return named;
  return input.email?.trim() || "Contact";
}

/**
 * Value for {{first_name}} — empty/generic → caller uses "there" fallback.
 */
export function firstNameForGreeting(input: {
  firstName?: string | null;
  title?: string | null;
  email?: string | null;
}): string {
  if (
    (input.title || "").trim().toLowerCase() ===
      GENERAL_INBOX_TITLE.toLowerCase() ||
    (input.email && isGeneralInboxRoleEmail(input.email))
  ) {
    return "";
  }
  const first = (input.firstName || "").trim();
  if (
    !first ||
    first.toLowerCase() === "general" ||
    first.toLowerCase() === "there"
  ) {
    return "";
  }
  return first;
}

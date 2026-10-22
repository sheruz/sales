/**
 * Safe email greeting — never "Hi info," for generic inboxes.
 */

const GENERIC_LOCAL_PARTS = new Set([
  "info",
  "office",
  "hello",
  "studio",
  "contact",
  "admin",
  "support",
  "sales",
  "help",
  "team",
  "enquiries",
  "inquiries",
  "mail",
  "general",
  "reception",
  "webmaster",
  "noreply",
  "no-reply",
  "donotreply",
]);

export function isGenericEmailLocalPart(email: string | null | undefined): boolean {
  if (!email || !email.includes("@")) return false;
  const local = email.split("@")[0]?.trim().toLowerCase() ?? "";
  if (!local) return true;
  if (GENERIC_LOCAL_PARTS.has(local)) return true;
  // info.sales, office-tx, etc.
  const base = local.split(/[._+-]/)[0] ?? local;
  return GENERIC_LOCAL_PARTS.has(base);
}

/**
 * Build greeting. Prefer pitch.greeting if set; else Hi {First}, or Hi there,.
 */
export function buildGreeting(input: {
  greeting?: string | null;
  firstName?: string | null;
  email?: string | null;
}): string {
  const explicit = input.greeting?.trim();
  if (explicit) {
    // Guard against bad stored greetings like "Hi info,"
    if (/^hi\s+info\b/i.test(explicit) || /^hi\s+office\b/i.test(explicit)) {
      return "Hi there,";
    }
    return explicit.endsWith(",") || explicit.endsWith("!")
      ? explicit
      : `${explicit.replace(/[,.!]+$/, "")},`;
  }

  const first = input.firstName?.trim() ?? "";
  if (
    !first ||
    isGenericEmailLocalPart(input.email) ||
    GENERIC_LOCAL_PARTS.has(first.toLowerCase())
  ) {
    return "Hi there,";
  }

  const capped = first.charAt(0).toUpperCase() + first.slice(1);
  return `Hi ${capped},`;
}

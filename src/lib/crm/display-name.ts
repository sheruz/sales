const GENERIC_LOCALS = new Set([
  "info",
  "contact",
  "office",
  "hello",
  "admin",
  "support",
  "sales",
  "team",
  "mail",
  "enquiries",
  "inquiry",
  "help",
]);

export function isGenericInboxEmail(email: string | null | undefined): boolean {
  if (!email?.includes("@")) return false;
  const local = email.split("@")[0]?.toLowerCase().trim() || "";
  return GENERIC_LOCALS.has(local);
}

/** Title-case a person name; map generic local-parts to "General inbox". */
export function displayContactName(
  fullName: string | null | undefined,
  email?: string | null
): { label: string; isGeneralInbox: boolean } {
  if (email && isGenericInboxEmail(email)) {
    return { label: "General inbox", isGeneralInbox: true };
  }
  const raw = (fullName || "").trim();
  if (!raw) {
    if (email) {
      const local = email.split("@")[0] || "Contact";
      if (GENERIC_LOCALS.has(local.toLowerCase())) {
        return { label: "General inbox", isGeneralInbox: true };
      }
      return { label: titleCase(local), isGeneralInbox: false };
    }
    return { label: "Unknown", isGeneralInbox: false };
  }
  if (email && GENERIC_LOCALS.has(raw.toLowerCase())) {
    return { label: "General inbox", isGeneralInbox: true };
  }
  return { label: titleCase(raw), isGeneralInbox: false };
}

export function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Consumer free-mail From domains — blocked in outbound pool unless overridden. */

const FREE_MAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "ymail.com",
  "yahoo.co.uk",
  "icloud.com",
  "me.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
]);

export function isFreeMailDomain(emailOrDomain: string | null | undefined): boolean {
  if (!emailOrDomain?.trim()) return false;
  const raw = emailOrDomain.trim().toLowerCase();
  const domain = raw.includes("@") ? raw.split("@").pop()! : raw;
  return FREE_MAIL_DOMAINS.has(domain);
}

export function assertOutboundFromAllowed(input: {
  fromEmail: string;
  allowFreeMailProvider: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (!isFreeMailDomain(input.fromEmail)) return { ok: true };
  if (input.allowFreeMailProvider) return { ok: true };
  return {
    ok: false,
    reason:
      "Free-mail From domains (Gmail/Outlook/Yahoo/etc.) are blocked for outbound. Enable “Allow free-mail” on this mailbox to override.",
  };
}

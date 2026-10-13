/**
 * WhatsApp number helpers — store E.164, render wa.me + display.
 */

/** Digits only for wa.me (no +). Returns null if invalid. */
export function whatsappDigits(e164OrRaw: string | null | undefined): string | null {
  if (!e164OrRaw?.trim()) return null;
  const digits = e164OrRaw.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

/** Normalize to +E.164 storage form. */
export function normalizeWhatsappE164(
  raw: string | null | undefined
): string | null {
  const digits = whatsappDigits(raw);
  if (!digits) return null;
  return `+${digits}`;
}

/**
 * Human display e.g. +1 210 555 0100 (US-ish grouping for 11-digit NANP).
 * Falls back to +digits.
 */
export function formatWhatsappDisplay(
  e164OrRaw: string | null | undefined
): string {
  const digits = whatsappDigits(e164OrRaw);
  if (!digits) return "";
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+1 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  // Group remaining: +CC rest
  if (digits.length > 10) {
    const cc = digits.slice(0, digits.length - 10);
    const rest = digits.slice(digits.length - 10);
    return `+${cc} ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
  }
  return `+${digits}`;
}

export function whatsappMeUrl(e164OrRaw: string | null | undefined): string | null {
  const digits = whatsappDigits(e164OrRaw);
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

/**
 * Reject AI reply_text that invents prices or unsafe links.
 */

export type ValidateReplyInput = {
  replyText: string;
  bookingUrl?: string | null;
  websiteUrl?: string | null;
  maxLen?: number;
  minLen?: number;
};

export type ValidateReplyResult =
  | { ok: true }
  | { ok: false; reason: string };

const CURRENCY_RE =
  /(?:\$|€|£|usd|eur|gbp)\s*\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s*(?:usd|eur|gbp|dollars?|euros?|pounds?)/i;

const PRICE_PHRASE_RE =
  /\b(?:price|pricing|quote|cost|fee|rate|discount|%\s*off|guarantee)\b/i;

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;

function normalizeUrl(u: string): string {
  try {
    const url = new URL(u.trim());
    url.hash = "";
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return u.trim().toLowerCase().replace(/\/$/, "");
  }
}

export function validateAiReplyText(
  input: ValidateReplyInput
): ValidateReplyResult {
  const text = (input.replyText || "").trim();
  const maxLen = input.maxLen ?? 4000;
  const minLen = input.minLen ?? 1;

  if (!text || text.length < minLen) {
    return { ok: false, reason: "empty_reply" };
  }
  if (text.length > maxLen) {
    return { ok: false, reason: "reply_too_long" };
  }

  if (CURRENCY_RE.test(text)) {
    return { ok: false, reason: "contains_price_or_currency" };
  }

  // Soft: "price" alone with a number nearby
  if (PRICE_PHRASE_RE.test(text) && /\d/.test(text)) {
    return { ok: false, reason: "contains_price_language" };
  }

  const allowed = new Set<string>();
  if (input.bookingUrl?.trim()) allowed.add(normalizeUrl(input.bookingUrl));
  if (input.websiteUrl?.trim()) allowed.add(normalizeUrl(input.websiteUrl));

  const urls = text.match(URL_RE) || [];
  for (const raw of urls) {
    const n = normalizeUrl(raw);
    if (!allowed.has(n)) {
      // Allow exact host match of website
      let okHost = false;
      for (const a of allowed) {
        try {
          if (new URL(n).hostname === new URL(a).hostname) okHost = true;
        } catch {
          /* ignore */
        }
      }
      if (!okHost) {
        return { ok: false, reason: "disallowed_link" };
      }
    }
  }

  return { ok: true };
}

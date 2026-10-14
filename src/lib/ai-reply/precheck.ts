/**
 * Deterministic pre-checks BEFORE AI. AI never decides these.
 */

export type PrecheckResult =
  | {
      kind: "out_of_office";
      returnDate: Date | null;
      reasoning: string;
    }
  | {
      kind: "unsubscribe";
      reasoning: string;
    }
  | { kind: "none" };

const UNSUB_PATTERNS = [
  /\bunsubscribe\b/i,
  /\bremove me\b/i,
  /\bstop emailing\b/i,
  /\bopt[\s-]?out\b/i,
  /\btake me off (your |the )?list\b/i,
  /\bdo not (email|contact) me\b/i,
  /\bplease stop\b/i,
];

const OOO_BODY_PATTERNS = [
  /\bout of (the )?office\b/i,
  /\bautomatic reply\b/i,
  /\bauto[\s-]?reply\b/i,
  /\baway from (my |the )?office\b/i,
  /\bon leave\b/i,
  /\bon vacation\b/i,
  /\bwill be (back|returning)\b/i,
  /\bcurrently unavailable\b/i,
  /\bi am away\b/i,
  /\bi'm away\b/i,
];

export type InboundHeaders = {
  autoSubmitted?: string | null;
  xAutoreply?: string | null;
  xAutorespond?: string | null;
  precedence?: string | null;
  subject?: string | null;
};

function headerSaysAutoReply(headers: InboundHeaders): boolean {
  const auto = (headers.autoSubmitted || "").trim().toLowerCase();
  if (auto && auto !== "no") return true;

  const x =
    (headers.xAutoreply || headers.xAutorespond || "").trim().toLowerCase();
  if (x === "yes" || x === "true" || x === "auto") return true;

  const prec = (headers.precedence || "").trim().toLowerCase();
  if (prec === "bulk" || prec === "junk" || prec === "list" || prec === "auto_reply")
    return true;

  return false;
}

/** Parse common return-date phrases from OOO bodies. */
export function parseOooReturnDate(
  body: string,
  now = new Date()
): Date | null {
  const text = body.slice(0, 4000);

  // ISO-ish: 2026-10-20 or 20/10/2026
  const iso = text.match(
    /\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/
  );
  if (iso) {
    const d = new Date(
      Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12)
    );
    if (!Number.isNaN(d.getTime()) && d > now) return d;
  }

  const months =
    "january|february|march|april|may|june|july|august|september|october|november|december";
  const named = text.match(
    new RegExp(
      `\\b(?:until|back|returning|return(?:ing)? on)\\s+(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(${months})\\b`,
      "i"
    )
  );
  if (named) {
    const day = Number(named[1]);
    const monthName = named[2].toLowerCase();
    const monthIndex = months.split("|").indexOf(monthName);
    let year = now.getUTCFullYear();
    let d = new Date(Date.UTC(year, monthIndex, day, 12));
    if (d <= now) {
      year += 1;
      d = new Date(Date.UTC(year, monthIndex, day, 12));
    }
    if (!Number.isNaN(d.getTime())) return d;
  }

  const inDays = text.match(/\bin\s+(\d{1,3})\s+days?\b/i);
  if (inDays) {
    const n = Number(inDays[1]);
    if (n > 0 && n < 365) {
      const d = new Date(now.getTime() + n * 86_400_000);
      return d;
    }
  }

  return null;
}

export function runDeterministicPrecheck(input: {
  headers?: InboundHeaders | null;
  subject?: string | null;
  body?: string | null;
  now?: Date;
}): PrecheckResult {
  const subject = input.subject || "";
  const body = input.body || "";
  const combined = `${subject}\n${body}`;
  const headers = input.headers || {};

  for (const re of UNSUB_PATTERNS) {
    if (re.test(combined)) {
      return {
        kind: "unsubscribe",
        reasoning: `Matched opt-out keyword: ${re.source}`,
      };
    }
  }

  const headerOoo = headerSaysAutoReply(headers);
  const bodyOoo =
    OOO_BODY_PATTERNS.some((re) => re.test(combined)) ||
    /^re:\s*out of office/i.test(subject) ||
    /automatic reply:/i.test(subject);

  if (headerOoo || bodyOoo) {
    const returnDate = parseOooReturnDate(combined, input.now ?? new Date());
    return {
      kind: "out_of_office",
      returnDate,
      reasoning: headerOoo
        ? "Auto-reply headers (Auto-Submitted / X-Autoreply / Precedence)"
        : "OOO / auto-reply body patterns",
    };
  }

  return { kind: "none" };
}

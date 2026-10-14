import type { HoldTriggerId } from "./config";

const TRIGGER_PATTERNS: Record<HoldTriggerId, RegExp[]> = {
  pricing: [
    /\bpric(e|ing)\b/i,
    /\bquote\b/i,
    /\bbudget\b/i,
    /\bhow much\b/i,
    /\bcost\b/i,
    /\brate card\b/i,
  ],
  contract: [
    /\bcontract\b/i,
    /\bnda\b/i,
    /\blegal (review|team)\b/i,
    /\bmsa\b/i,
    /\bterms of (service|use)\b/i,
  ],
  payment: [
    /\binvoice\b/i,
    /\bpayment\b/i,
    /\bwiring\b/i,
    /\bbank details\b/i,
    /\bpo number\b/i,
  ],
  complaint: [
    /\bangry\b/i,
    /\bunacceptable\b/i,
    /\bcomplaint\b/i,
    /\bterrible\b/i,
    /\bspam\b/i,
    /\bharrass/i,
  ],
  uncovered_tech: [
    /\bintegrat(e|ion)\b/i,
    /\bapi\b/i,
    /\btechnical (question|detail|spec)\b/i,
    /\barchitecture\b/i,
  ],
  call_now: [
    /\bcall me (now|today|asap)\b/i,
    /\bphone (call|me) (now|asap)\b/i,
    /\bright now\b/i,
  ],
  legal: [
    /\blawyer\b/i,
    /\battorney\b/i,
    /\bregulator\b/i,
    /\bgdpr\b/i,
    /\bccpa\b/i,
    /\blitigation\b/i,
  ],
  non_english: [], // detected separately
};

/** Heuristic: mostly non-ASCII letters → likely non-English */
export function looksNonEnglish(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u4e00-\u9fff]/g, "");
  if (letters.length < 20) return false;
  const ascii = (letters.match(/[a-zA-Z]/g) || []).length;
  return ascii / letters.length < 0.55;
}

export function detectHoldTriggers(
  text: string,
  enabled: HoldTriggerId[],
  opts?: { nonEnglishHold?: boolean; aiHoldReason?: string | null }
): string | null {
  if (opts?.aiHoldReason?.trim()) return opts.aiHoldReason.trim().slice(0, 200);

  const enabledSet = new Set(enabled);
  for (const id of enabled) {
    if (id === "non_english") continue;
    const patterns = TRIGGER_PATTERNS[id] || [];
    for (const re of patterns) {
      if (re.test(text)) return id;
    }
  }

  if (
    enabledSet.has("non_english") &&
    opts?.nonEnglishHold !== false &&
    looksNonEnglish(text)
  ) {
    return "non_english";
  }

  return null;
}

import { findBannedPhrases } from "@/lib/pow/banned-phrases";
import {
  POW_SUBJECT_MAX,
  POW_WORD_MAX,
  POW_WORD_MIN,
} from "@/lib/pow/constants";

export type PowStepDraft = {
  day: 0 | 3 | 7 | 14;
  subject: string;
  body: string;
};

export type PowValidationResult = {
  ok: boolean;
  wordCount: number;
  wordCountOk: boolean;
  bannedPhrases: string[];
  inventedNumbers: string[];
  numbersOk: boolean;
  greetingOk: boolean;
  formatOk: boolean;
  subjectOk: boolean;
  linkCount: number;
  linkOk: boolean;
  errors: string[];
};

const NUMBER_RE = /\d[\d,]*(?:\.\d+)?%?/g;
const HTML_RE = /<\/?[a-z][\s\S]*?>/i;
const URL_RE = /https?:\/\/[^\s]+/gi;

export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function extractNumbers(text: string): string[] {
  const matches = text.match(NUMBER_RE) ?? [];
  // Ignore trivial: single digits used in "day 3" style are still checked —
  // caller passes allowed set from evidence. Filter out bare year-like only if needed.
  return [...new Set(matches.map((m) => m.replace(/,/g, "")))];
}

/**
 * Every number in the email must appear in evidence (or allowlist like day offsets).
 */
export function findInventedNumbers(
  emailText: string,
  evidenceText: string,
  allowlist: string[] = []
): string[] {
  const allowed = new Set(
    [
      ...extractNumbers(evidenceText),
      ...allowlist,
      "0",
      "3",
      "7",
      "14", // sequence day labels if AI mentions them
    ].map((n) => n.replace(/,/g, ""))
  );
  const found = extractNumbers(emailText);
  return found.filter((n) => !allowed.has(n.replace(/,/g, "")));
}

export function countHttpLinks(text: string): number {
  return (text.match(URL_RE) ?? []).length;
}

export function validateGreeting(
  body: string,
  firstName: string | null | undefined,
  companyName: string
): boolean {
  const firstLine = body.trim().split(/\n/)[0]?.trim() ?? "";
  if (/^hi there\b/i.test(firstLine)) return false;
  if (firstName?.trim()) {
    const re = new RegExp(
      `^hi\\s+${escapeRe(firstName.trim())}\\b`,
      "i"
    );
    return re.test(firstLine);
  }
  const re = new RegExp(
    `^hi\\s+${escapeRe(companyName.trim())}\\s+team\\b`,
    "i"
  );
  return re.test(firstLine);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function validatePowStep(opts: {
  step: PowStepDraft;
  evidenceText: string;
  firstName?: string | null;
  companyName: string;
  /** Day 0 may include unresolved {{preview_url}} — not counted as a link */
  allowPreviewPlaceholder?: boolean;
}): PowValidationResult {
  const { step, evidenceText, firstName, companyName } = opts;
  const bodyForLinks = opts.allowPreviewPlaceholder
    ? step.body.replace(/\{\{\s*preview_url\s*\}\}/gi, "")
    : step.body;
  const combined = `${step.subject}\n${step.body}`;
  const wordCount = countWords(step.body);
  const wordCountOk = wordCount >= POW_WORD_MIN && wordCount <= POW_WORD_MAX;
  const bannedPhrases = findBannedPhrases(combined);
  const inventedNumbers = findInventedNumbers(combined, evidenceText);
  const numbersOk = inventedNumbers.length === 0;
  const greetingOk = validateGreeting(step.body, firstName, companyName);
  const hasHtml = HTML_RE.test(step.body) || HTML_RE.test(step.subject);
  const hasHeading = /^(#{1,6}\s|.*:$)/m.test(step.body.split("\n")[1] ?? "");
  const formatOk = !hasHtml && !/\b(button|unsubscribe here)\b/i.test(step.body);
  void hasHeading;
  const linkCount = countHttpLinks(bodyForLinks);
  const linkOk = linkCount <= 1;
  const subjectOk =
    step.subject.trim().length > 0 &&
    step.subject.trim().length <= POW_SUBJECT_MAX &&
    !HTML_RE.test(step.subject);

  const errors: string[] = [];
  if (!wordCountOk) {
    errors.push(`word count ${wordCount} not in ${POW_WORD_MIN}–${POW_WORD_MAX}`);
  }
  if (bannedPhrases.length) {
    errors.push(`banned phrases: ${bannedPhrases.join(", ")}`);
  }
  if (!numbersOk) {
    errors.push(`invented numbers: ${inventedNumbers.join(", ")}`);
  }
  if (!greetingOk) {
    errors.push("greeting must be Hi {first name} or Hi {Company} team");
  }
  if (!formatOk || hasHtml) {
    errors.push("must be plain text (no HTML/headings/buttons)");
  }
  if (!linkOk) {
    errors.push(`at most one link (found ${linkCount})`);
  }
  if (!subjectOk) {
    errors.push(`subject must be plain text ≤${POW_SUBJECT_MAX} chars`);
  }

  return {
    ok: errors.length === 0,
    wordCount,
    wordCountOk,
    bannedPhrases,
    inventedNumbers,
    numbersOk,
    greetingOk,
    formatOk: formatOk && !hasHtml,
    subjectOk,
    linkCount,
    linkOk,
    errors,
  };
}

export function validatePowDraft(opts: {
  steps: PowStepDraft[];
  evidenceText: string;
  firstName?: string | null;
  companyName: string;
}): { ok: boolean; perStep: PowValidationResult[]; errors: string[] } {
  const perStep = opts.steps.map((step) =>
    validatePowStep({
      step,
      evidenceText: opts.evidenceText,
      firstName: opts.firstName,
      companyName: opts.companyName,
      allowPreviewPlaceholder: step.day === 0,
    })
  );
  const errors = perStep.flatMap((v, i) =>
    v.errors.map((e) => `day ${opts.steps[i]?.day}: ${e}`)
  );
  return { ok: errors.length === 0, perStep, errors };
}

/**
 * PoW3 — merge vars for Proof of Work sequence templates.
 */

export type PowStepDay = 0 | 3 | 7 | 14;

export type PowDraftForMerge = {
  steps?: Array<{ day: PowStepDay | number; subject: string; body: string }>;
};

export function buildPowFooter(opts: {
  senderName: string;
  businessName?: string | null;
  businessAddress?: string | null;
  unsubscribeUrl: string;
}): string {
  const lines = [
    opts.senderName.trim(),
    [opts.businessName?.trim(), opts.businessAddress?.trim()]
      .filter(Boolean)
      .join(" · "),
    `Unsubscribe: ${opts.unsubscribeUrl}`,
  ].filter(Boolean);
  return lines.join("\n");
}

/** Writer may embed {{preview_url}} inside the day-0 body — expand before template merge. */
function expandNestedPowTokens(
  text: string,
  previewUrl: string,
  footer: string
): string {
  return text
    .replace(/\{\{\s*preview_url\s*\}\}/gi, previewUrl)
    .replace(/\{\{\s*pow_footer\s*\}\}/gi, footer);
}

export function buildPowTemplateVars(opts: {
  draft: PowDraftForMerge | null | undefined;
  previewUrl: string;
  footer: string;
}): Record<string, string> {
  const steps = opts.draft?.steps ?? [];
  const byDay = new Map(steps.map((s) => [s.day as PowStepDay, s]));

  const day0 = byDay.get(0);
  const day3 = byDay.get(3);
  const day7 = byDay.get(7);
  const day14 = byDay.get(14);

  const body = (raw: string | undefined) =>
    expandNestedPowTokens(raw?.trim() || "", opts.previewUrl, opts.footer);

  return {
    pow_subject_day0: day0?.subject?.trim() || "",
    pow_subject_day3: day3?.subject?.trim() || "",
    pow_subject_day7: day7?.subject?.trim() || "",
    pow_subject_day14: day14?.subject?.trim() || "",
    pow_body_day0: body(day0?.body),
    pow_body_day3: body(day3?.body),
    pow_body_day7: body(day7?.body),
    pow_body_day14: body(day14?.body),
    preview_url: opts.previewUrl,
    pow_footer: opts.footer,
  };
}

/** Required keys that must not fall back for a given step template. */
export const POW_REQUIRED_VARS_DAY0 = [
  "pow_subject_day0",
  "pow_body_day0",
  "preview_url",
  "pow_footer",
] as const;

export function powRequiredVarsForTemplate(template: string): string[] {
  const keys = new Set<string>();
  const re = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template))) {
    const k = m[1];
    if (k.startsWith("pow_") || k === "preview_url") keys.add(k);
  }
  return [...keys];
}

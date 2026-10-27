/**
 * Deep-audit finding helpers: severity rules, confidence, plain-language copy.
 * Speed findings must come from PageSpeed Insights — never Playwright timings alone.
 */

import type { PageSpeedResult } from "@/lib/audit/pagespeed.adapter";
import {
  PSI_LCP_POOR_MS,
  PSI_SCORE_POOR,
  type DeepFinding,
  type DeepFindingConfidence,
} from "@/lib/audit/deep/types";

export function makeFinding(input: {
  id: string;
  severity: DeepFinding["severity"];
  title: string;
  whyItMatters: string;
  evidence: string;
  confidence: DeepFindingConfidence;
  viewport?: DeepFinding["viewport"];
}): DeepFinding {
  return {
    id: input.id,
    severity: input.severity,
    title: input.title,
    whyItMatters: input.whyItMatters,
    evidence: input.evidence,
    confidence: input.confidence,
    observed: true,
    viewport: input.viewport,
    emailEligible: input.confidence === "High",
  };
}

/**
 * Speed finding from PSI only. Playwright ms is supporting evidence in the string.
 * Severity is always B. High confidence only when lab + field (or lab + Playwright) agree.
 */
export function speedFindingFromPageSpeed(opts: {
  psi: PageSpeedResult;
  playwrightMobileMs?: number;
  playwrightDesktopMs?: number;
}): DeepFinding | null {
  const { psi, playwrightMobileMs, playwrightDesktopMs } = opts;
  if (psi.error && psi.score == null && psi.metrics.lcpMs == null) {
    return null;
  }

  const lcpMs = psi.metrics.lcpMs;
  const fieldLcpMs = psi.fieldMetrics?.lcpMs ?? null;
  const score = psi.score;
  const labPoor =
    (lcpMs != null && lcpMs > PSI_LCP_POOR_MS) ||
    (score != null && score < PSI_SCORE_POOR);
  if (!labPoor) return null;

  const fieldPoor =
    fieldLcpMs != null && fieldLcpMs > PSI_LCP_POOR_MS;
  const playwrightSlow =
    (playwrightMobileMs != null && playwrightMobileMs > 8_000) ||
    (playwrightDesktopMs != null && playwrightDesktopMs > 8_000);

  let confidence: DeepFindingConfidence = "Medium";
  if (fieldPoor || (playwrightSlow && labPoor)) {
    confidence = "High";
  }

  const lcpSec =
    lcpMs != null ? `${(lcpMs / 1000).toFixed(1)}s` : "n/a";
  const fieldBit =
    fieldLcpMs != null
      ? ` CrUX field LCP ${(fieldLcpMs / 1000).toFixed(1)}s.`
      : " No CrUX field LCP available.";
  const pwBits: string[] = [];
  if (playwrightMobileMs != null) {
    pwBits.push(`our browser mobile ${playwrightMobileMs}ms`);
  }
  if (playwrightDesktopMs != null) {
    pwBits.push(`our browser desktop ${playwrightDesktopMs}ms`);
  }
  const support =
    pwBits.length > 0
      ? ` Supporting (not headline): ${pwBits.join(", ")}.`
      : "";

  return makeFinding({
    id: "slow_mobile_psi",
    severity: "B",
    title: "Homepage loads slowly on phones",
    whyItMatters:
      "Owners who open your site on a phone may leave before they see what you offer.",
    evidence: `Google PageSpeed mobile: score ${score ?? "—"}/100, lab LCP ${lcpSec}.${fieldBit}${support}`,
    confidence,
    viewport: "mobile",
  });
}

/** Sort A → C, then by id for stability */
export function sortFindings(findings: DeepFinding[]): DeepFinding[] {
  const order: Record<string, number> = { A: 0, B: 1, C: 2 };
  return [...findings].sort((a, b) => {
    const d = (order[a.severity] ?? 9) - (order[b.severity] ?? 9);
    return d !== 0 ? d : a.id.localeCompare(b.id);
  });
}

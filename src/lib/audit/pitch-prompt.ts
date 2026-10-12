/**
 * Claude pitch prompt + JSON parse/validation for Phase 3.
 */

import type { CheckResult } from "@/lib/audit/rule-checks";

export type PitchIssue = {
  issue: string;
  evidence: string;
  business_impact: string;
};

export type PitchAiResult = {
  top_issues: PitchIssue[];
  recommended_service: string;
  personalized_first_line: string;
  short_pitch: string;
  confidence: number;
};

export type PitchPromptContext = {
  companyName: string;
  contactFirstName: string | null;
  contactTitle: string | null;
  city: string | null;
  industry: string | null;
  checks: CheckResult[];
  services: Array<{ id: string; name: string; description: string }>;
  caseStudies: Array<{
    title: string;
    customerIndustry: string | null;
    problem: string | null;
    outcome: string | null;
  }>;
};

export const PITCH_SYSTEM_PROMPT = `You write respectful, evidence-based sales openers from measured website checks.

Return ONLY valid JSON:
{
  "top_issues": [{"issue":"...","evidence":"...","business_impact":"..."}],
  "recommended_service": "...",
  "personalized_first_line": "...",
  "short_pitch": "...",
  "confidence": 0-100
}

Rules:
- Every issue MUST cite evidence from the provided checks (quote or paraphrase the check evidence). Do NOT invent problems that are not in the checks.
- Prefer failed/warn checks (pass=false). If few failures, use weaker opportunity signals carefully and still cite evidence.
- Respectful tone — never insult their site, design, or team.
- No prices, discounts, or guarantees.
- personalized_first_line: under 40 words, natural, uses first name when available.
- short_pitch: 2–4 sentences tying issues to ONE recommended_service from the provided services list (use the service name exactly when possible).
- confidence: integer 0–100 reflecting how well evidence supports the pitch.
- No markdown, no commentary outside JSON.`;

export function buildPitchUserPayload(ctx: PitchPromptContext) {
  const evidenceChecks = ctx.checks.map((c) => ({
    id: c.id,
    label: c.label,
    pass: c.pass,
    severity: c.severity,
    evidence: c.evidence,
    niche: c.niche ?? false,
  }));

  return {
    company: {
      name: ctx.companyName,
      city: ctx.city,
      industry: ctx.industry,
    },
    contact: {
      first_name: ctx.contactFirstName,
      title: ctx.contactTitle,
    },
    checks: evidenceChecks,
    services: ctx.services.map((s) => ({
      name: s.name,
      description: s.description.slice(0, 280),
    })),
    case_studies: ctx.caseStudies.slice(0, 8).map((c) => ({
      title: c.title,
      industry: c.customerIndustry,
      problem: c.problem,
      outcome: c.outcome,
    })),
  };
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function asIssue(raw: unknown): PitchIssue | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const issue = typeof o.issue === "string" ? o.issue.trim() : "";
  const evidence = typeof o.evidence === "string" ? o.evidence.trim() : "";
  const business_impact =
    typeof o.business_impact === "string"
      ? o.business_impact.trim()
      : typeof o.businessImpact === "string"
        ? o.businessImpact.trim()
        : "";
  if (!issue || !evidence) return null;
  return { issue, evidence, business_impact: business_impact || issue };
}

/**
 * Validate AI JSON. Ensures issues cite check evidence (substring/overlap heuristic).
 */
export function validatePitchAiResult(
  raw: unknown,
  checks: CheckResult[]
): { ok: true; value: PitchAiResult } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Pitch JSON is not an object" };
  }
  const o = raw as Record<string, unknown>;
  const issuesRaw = Array.isArray(o.top_issues)
    ? o.top_issues
    : Array.isArray(o.topIssues)
      ? o.topIssues
      : null;
  if (!issuesRaw) {
    return { ok: false, error: "Missing top_issues array" };
  }

  const top_issues = issuesRaw
    .map(asIssue)
    .filter((x): x is PitchIssue => Boolean(x))
    .slice(0, 5);

  if (!top_issues.length) {
    return { ok: false, error: "No valid top_issues with evidence" };
  }

  const evidenceBlob = checks
    .map((c) => `${c.id} ${c.label} ${c.evidence}`.toLowerCase())
    .join("\n");

  for (const issue of top_issues) {
    const ev = issue.evidence.toLowerCase();
    const tokens = ev
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 4)
      .slice(0, 8);
    const hit =
      evidenceBlob.includes(ev.slice(0, 40)) ||
      tokens.some((t) => evidenceBlob.includes(t));
    if (!hit) {
      return {
        ok: false,
        error: `Issue evidence not grounded in checks: ${issue.issue}`,
      };
    }
  }

  const firstLine =
    typeof o.personalized_first_line === "string"
      ? o.personalized_first_line.trim()
      : typeof o.personalizedFirstLine === "string"
        ? o.personalizedFirstLine.trim()
        : "";
  if (!firstLine) {
    return { ok: false, error: "Missing personalized_first_line" };
  }
  if (wordCount(firstLine) > 40) {
    return {
      ok: false,
      error: `personalized_first_line exceeds 40 words (${wordCount(firstLine)})`,
    };
  }

  const short_pitch =
    typeof o.short_pitch === "string"
      ? o.short_pitch.trim()
      : typeof o.shortPitch === "string"
        ? o.shortPitch.trim()
        : "";
  if (!short_pitch) {
    return { ok: false, error: "Missing short_pitch" };
  }

  const recommended_service =
    typeof o.recommended_service === "string"
      ? o.recommended_service.trim()
      : typeof o.recommendedService === "string"
        ? o.recommendedService.trim()
        : "";
  if (!recommended_service) {
    return { ok: false, error: "Missing recommended_service" };
  }

  let confidence = 50;
  if (typeof o.confidence === "number" && Number.isFinite(o.confidence)) {
    confidence = Math.max(0, Math.min(100, Math.round(o.confidence)));
  }

  return {
    ok: true,
    value: {
      top_issues,
      recommended_service,
      personalized_first_line: firstLine,
      short_pitch,
      confidence,
    },
  };
}

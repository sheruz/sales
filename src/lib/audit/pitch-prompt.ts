/**
 * Claude pitch prompt + JSON parse/validation for Phase 3 (+ email redesign fields).
 */

import type { CheckResult } from "@/lib/audit/rule-checks";
import { looksLikeRawAuditLabel } from "@/lib/email/render-outbound";

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
  greeting: string;
  intro_html: string;
  finding_title: string;
  finding_text: string;
  body_html: string;
  preheader: string;
};

export type PitchPromptContext = {
  companyName: string;
  contactFirstName: string | null;
  contactTitle: string | null;
  contactEmail: string | null;
  city: string | null;
  industry: string | null;
  domain: string | null;
  checks: CheckResult[];
  services: Array<{ id: string; name: string; description: string }>;
  caseStudies: Array<{
    title: string;
    customerIndustry: string | null;
    problem: string | null;
    outcome: string | null;
  }>;
};

export const PITCH_SYSTEM_PROMPT = `You write respectful, evidence-based sales email copy from measured website checks.

Return ONLY valid JSON:
{
  "top_issues": [{"issue":"...","evidence":"...","business_impact":"..."}],
  "recommended_service": "...",
  "personalized_first_line": "...",
  "short_pitch": "...",
  "confidence": 0-100,
  "greeting": "Hi {First}," or "Hi there,",
  "intro_html": "<p>...</p> 1–2 sentences mentioning their domain",
  "finding_title": "short headline max 10 words — business language, NOT audit labels",
  "finding_text": "1–2 sentences on business impact",
  "body_html": "<p>...</p> what we build + soft ask",
  "preheader": "inbox preview max 90 characters"
}

Rules:
- Every issue MUST cite evidence from the provided checks. Do NOT invent problems.
- Prefer failed/warn checks (pass=false).
- Respectful tone — never insult their site, design, or team.
- No prices, discounts, or guarantees.
- personalized_first_line: under 40 words (legacy plain opener).
- short_pitch: 2–4 sentences tying issues to ONE recommended_service from the list.
- greeting: use first name when it is a real person name. For generic inboxes (info@, office@, hello@) or missing first name use exactly "Hi there," — NEVER "Hi info," or "Hi office,".
- intro_html: 1–2 sentences in simple HTML (<p> only). Mention their domain when provided.
- finding_title: max 10 words. Business impact headline. NEVER copy raw audit check labels (e.g. "No tenant or owner portal detected", "Mobile PageSpeed"). Rewrite into natural language.
- finding_text: 1–2 sentences on why it matters to the business.
- body_html: what we build + ask, simple HTML (<p> only).
- preheader: max 90 characters, curiosity without spam.
- confidence: integer 0–100.
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
      domain: ctx.domain,
    },
    contact: {
      first_name: ctx.contactFirstName,
      title: ctx.contactTitle,
      email: ctx.contactEmail,
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

function strField(
  o: Record<string, unknown>,
  snake: string,
  camel: string
): string {
  if (typeof o[snake] === "string") return (o[snake] as string).trim();
  if (typeof o[camel] === "string") return (o[camel] as string).trim();
  return "";
}

/**
 * Validate AI JSON. Ensures issues cite check evidence; blocks raw audit labels in finding_title.
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

  const firstLine = strField(o, "personalized_first_line", "personalizedFirstLine");
  if (!firstLine) {
    return { ok: false, error: "Missing personalized_first_line" };
  }
  if (wordCount(firstLine) > 40) {
    return {
      ok: false,
      error: `personalized_first_line exceeds 40 words (${wordCount(firstLine)})`,
    };
  }

  const short_pitch = strField(o, "short_pitch", "shortPitch");
  if (!short_pitch) {
    return { ok: false, error: "Missing short_pitch" };
  }

  const recommended_service = strField(
    o,
    "recommended_service",
    "recommendedService"
  );
  if (!recommended_service) {
    return { ok: false, error: "Missing recommended_service" };
  }

  let confidence = 50;
  if (typeof o.confidence === "number" && Number.isFinite(o.confidence)) {
    confidence = Math.max(0, Math.min(100, Math.round(o.confidence)));
  }

  let greeting = strField(o, "greeting", "greeting") || "Hi there,";
  if (/^hi\s+(info|office|hello|contact|admin)\b/i.test(greeting)) {
    greeting = "Hi there,";
  }

  const intro_html =
    strField(o, "intro_html", "introHtml") ||
    `<p>${firstLine}</p>`;

  let finding_title =
    strField(o, "finding_title", "findingTitle") ||
    top_issues[0]?.issue ||
    "A site opportunity worth a look";
  if (wordCount(finding_title) > 10) {
    finding_title = finding_title.split(/\s+/).slice(0, 10).join(" ");
  }
  const labels = checks.map((c) => c.label);
  if (looksLikeRawAuditLabel(finding_title, labels)) {
    // Rewrite from business_impact / issue without using the raw label
    const impact = top_issues[0]?.business_impact?.trim();
    finding_title = impact
      ? impact.split(/\s+/).slice(0, 10).join(" ")
      : "A site opportunity worth a look";
    if (looksLikeRawAuditLabel(finding_title, labels)) {
      finding_title = "A site opportunity worth a look";
    }
  }

  const finding_text =
    strField(o, "finding_text", "findingText") ||
    top_issues[0]?.business_impact ||
    short_pitch.slice(0, 220);

  const body_html =
    strField(o, "body_html", "bodyHtml") || `<p>${short_pitch}</p>`;

  let preheader = strField(o, "preheader", "preheader") || finding_title;
  if (preheader.length > 90) preheader = preheader.slice(0, 90);

  return {
    ok: true,
    value: {
      top_issues,
      recommended_service,
      personalized_first_line: firstLine,
      short_pitch,
      confidence,
      greeting,
      intro_html,
      finding_title,
      finding_text,
      body_html,
      preheader,
    },
  };
}

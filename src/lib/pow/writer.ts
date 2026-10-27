/**
 * PoW2 AI writer — plain-text PoW emails with code-enforced validators.
 */

import { aiComplete, parseAIJson } from "@/lib/ai/provider";
import {
  type PowStepDraft,
  validatePowDraft,
} from "@/lib/pow/validators";
import type { UsableFinding } from "@/lib/pow/usable-findings";

export type PowWriterInput = {
  organizationId: string;
  userId?: string;
  companyName: string;
  domainOrHost: string;
  firstName?: string | null;
  finding: UsableFinding;
  secondFinding?: UsableFinding | null;
  starterOffer?: {
    name: string;
    price: number;
    currency: string;
    deliveryDays: number;
    includes: string;
  } | null;
  caseStudy?: {
    clientType: string;
    problem: string;
    whatBuilt: string;
    result: string;
  } | null;
  senderName: string;
  businessAddress: string;
  /** billingAuthorized when parent already reserved audit_pitch */
  billingAuthorized?: boolean;
};

export type PowWriterResult = {
  status: "ready" | "flagged" | "rejected";
  steps: PowStepDraft[];
  validation: ReturnType<typeof validatePowDraft>;
  regenerated: boolean;
  modelUsed: string | null;
  raw?: unknown;
};

const SYSTEM = `You write short plain-text cold emails for a proof-of-work outreach sequence.
Rules (mandatory):
- Plain text only. No HTML, headings, buttons, images, or markdown.
- 60–100 words per email body.
- Greeting: "Hi {FirstName}" or if no first name "Hi {Company} team". Never "Hi there".
- No flattery: never use words like impressive, we were impressed, I came across, great work, congratulations, hope this finds you well.
- Only use facts from the FINDING EVIDENCE provided. Do not invent numbers, clients, results, or revenue.
- Subject: names the specific problem + site host, lowercase-friendly, under 50 characters (e.g. "quote form on northlinefreight.ca").
- CTA: one low-friction question ending like "Want me to send the details?"
- Day 0 body must include the literal token {{preview_url}} on its own line (PoW3 fills it).
- Day 3: one more detail from the same or second finding.
- Day 7: if a case study is provided, one short sentence with only its real numbers; if a starter offer is provided, mention name, price, and days. If case study missing, omit that line.
- Day 14: polite breakup — closing their file; ask if you should send this to someone else.
- Return JSON only.`;

function buildUserPayload(input: PowWriterInput): string {
  return JSON.stringify(
    {
      companyName: input.companyName,
      host: input.domainOrHost,
      firstName: input.firstName?.trim() || null,
      finding: {
        id: input.finding.id,
        severity: input.finding.severity,
        title: input.finding.title,
        whyItMatters: input.finding.whyItMatters,
        evidence: input.finding.evidence,
      },
      secondFinding: input.secondFinding
        ? {
            id: input.secondFinding.id,
            title: input.secondFinding.title,
            evidence: input.secondFinding.evidence,
          }
        : null,
      starterOffer: input.starterOffer,
      caseStudy: input.caseStudy,
      senderName: input.senderName,
      businessAddress: input.businessAddress,
      outputSchema: {
        steps: [
          { day: 0, subject: "string", body: "string" },
          { day: 3, subject: "string", body: "string" },
          { day: 7, subject: "string", body: "string" },
          { day: 14, subject: "string", body: "string" },
        ],
      },
    },
    null,
    2
  );
}

function parseSteps(raw: unknown): PowStepDraft[] | null {
  if (!raw || typeof raw !== "object") return null;
  const steps = (raw as { steps?: unknown }).steps;
  if (!Array.isArray(steps) || steps.length < 4) return null;
  const days = [0, 3, 7, 14] as const;
  const out: PowStepDraft[] = [];
  for (let i = 0; i < 4; i++) {
    const s = steps[i];
    if (!s || typeof s !== "object") return null;
    const row = s as Record<string, unknown>;
    out.push({
      day: days[i],
      subject: String(row.subject ?? "").trim(),
      body: String(row.body ?? "").trim(),
    });
  }
  return out;
}

function evidenceBlob(input: PowWriterInput): string {
  const parts = [input.finding.evidence, input.finding.title];
  if (input.secondFinding) {
    parts.push(input.secondFinding.evidence, input.secondFinding.title);
  }
  if (input.starterOffer) {
    parts.push(
      String(input.starterOffer.price),
      String(input.starterOffer.deliveryDays),
      input.starterOffer.name
    );
  }
  if (input.caseStudy) {
    parts.push(
      input.caseStudy.result,
      input.caseStudy.problem,
      input.caseStudy.whatBuilt
    );
  }
  return parts.join("\n");
}

async function generateOnce(
  input: PowWriterInput
): Promise<{ steps: PowStepDraft[]; modelUsed: string | null; raw: unknown }> {
  const result = await aiComplete({
    feature: "pow_pitch",
    purpose: "audit_pitch",
    organizationId: input.organizationId,
    userId: input.userId,
    billingAuthorized: input.billingAuthorized,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: buildUserPayload(input) },
    ],
  });
  const parsed = parseAIJson(result.content);
  const steps = parseSteps(parsed);
  if (!steps) {
    throw new Error("PoW writer returned invalid JSON steps");
  }
  return { steps, modelUsed: result.model ?? null, raw: parsed };
}

/**
 * Generate PoW draft. On invented-number failure: regenerate once, then flag.
 */
export async function generatePowEmails(
  input: PowWriterInput
): Promise<PowWriterResult> {
  const evidenceText = evidenceBlob(input);
  let regenerated = false;
  let { steps, modelUsed, raw } = await generateOnce(input);
  let validation = validatePowDraft({
    steps,
    evidenceText,
    firstName: input.firstName,
    companyName: input.companyName,
  });

  const numberFail = validation.perStep.some((p) => !p.numbersOk);
  if (numberFail || !validation.ok) {
    // Prefer regenerate when numbers invented or hard fail
    if (numberFail || validation.errors.some((e) => /invented numbers|banned|word count|greeting|HTML/i.test(e))) {
      regenerated = true;
      const second = await generateOnce(input);
      steps = second.steps;
      modelUsed = second.modelUsed;
      raw = second.raw;
      validation = validatePowDraft({
        steps,
        evidenceText,
        firstName: input.firstName,
        companyName: input.companyName,
      });
    }
  }

  if (!validation.ok) {
    const stillNumbers = validation.perStep.some((p) => !p.numbersOk);
    return {
      status: stillNumbers ? "flagged" : "rejected",
      steps,
      validation,
      regenerated,
      modelUsed,
      raw,
    };
  }

  return {
    status: "ready",
    steps,
    validation,
    regenerated,
    modelUsed,
    raw,
  };
}

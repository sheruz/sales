import { MessageAiClassification } from "@prisma/client";

/**
 * Phase 5 canonical classifier outputs.
 * Legacy enum values remain in DB for old rows — never emit from new AI.
 */
export const PHASE5_CLASSES = [
  "interested",
  "question",
  "not_now",
  "not_interested",
  "wrong_person",
  "unsubscribe",
  "out_of_office",
  "other",
] as const;

export type Phase5Class = (typeof PHASE5_CLASSES)[number];

export const PHASE5_CLASS_TO_ENUM: Record<Phase5Class, MessageAiClassification> =
  {
    interested: MessageAiClassification.INTERESTED,
    question: MessageAiClassification.QUESTION,
    not_now: MessageAiClassification.NOT_NOW,
    not_interested: MessageAiClassification.NOT_INTERESTED,
    wrong_person: MessageAiClassification.WRONG_PERSON,
    unsubscribe: MessageAiClassification.UNSUBSCRIBE,
    out_of_office: MessageAiClassification.OUT_OF_OFFICE,
    other: MessageAiClassification.OTHER,
  };

/** Legacy values — deprecated; map into Phase 5 for actions / UI. */
export const LEGACY_CLASS_MAP: Partial<
  Record<MessageAiClassification, MessageAiClassification>
> = {
  [MessageAiClassification.POSITIVE]: MessageAiClassification.INTERESTED,
  [MessageAiClassification.NEGATIVE]: MessageAiClassification.NOT_INTERESTED,
  /** Spec: OBJECTION → QUESTION */
  [MessageAiClassification.OBJECTION]: MessageAiClassification.QUESTION,
  [MessageAiClassification.NOT_RELEVANT]: MessageAiClassification.OTHER,
  [MessageAiClassification.REFERRAL]: MessageAiClassification.WRONG_PERSON,
  [MessageAiClassification.UNKNOWN]: MessageAiClassification.OTHER,
};

export function isLegacyClassification(
  c: MessageAiClassification | null | undefined
): boolean {
  if (!c) return false;
  return c in LEGACY_CLASS_MAP;
}

/** Normalize stored enum → Phase 5 action class (legacy mapped). */
export function toPhase5Class(
  c: MessageAiClassification | string | null | undefined
): MessageAiClassification {
  if (!c) return MessageAiClassification.OTHER;
  const key = String(c).trim().toUpperCase().replace(/\s+/g, "_");
  const asEnum = key as MessageAiClassification;
  if (LEGACY_CLASS_MAP[asEnum]) return LEGACY_CLASS_MAP[asEnum]!;
  if (
    Object.values(MessageAiClassification).includes(
      asEnum as MessageAiClassification
    )
  ) {
    return asEnum as MessageAiClassification;
  }
  return MessageAiClassification.OTHER;
}

export function parsePhase5ClassRaw(raw: string): Phase5Class {
  const n = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if ((PHASE5_CLASSES as readonly string[]).includes(n)) {
    return n as Phase5Class;
  }
  // Soft aliases from older prompts
  if (n.includes("interest") || n === "positive") return "interested";
  if (n.includes("question") || n === "objection") return "question";
  if (n.includes("not_now") || n.includes("later") || n.includes("timing"))
    return "not_now";
  if (n.includes("not_interest") || n.includes("negative"))
    return "not_interested";
  if (n.includes("wrong") || n.includes("referral")) return "wrong_person";
  if (n.includes("unsub") || n.includes("opt_out")) return "unsubscribe";
  if (n.includes("ooo") || n.includes("out_of_office") || n.includes("away"))
    return "out_of_office";
  return "other";
}

export function enumToPhase5Slug(
  c: MessageAiClassification
): Phase5Class {
  const mapped = toPhase5Class(c);
  const entry = Object.entries(PHASE5_CLASS_TO_ENUM).find(
    ([, v]) => v === mapped
  );
  return (entry?.[0] as Phase5Class) ?? "other";
}

/**
 * Confidence gate: anything below the org threshold is demoted to `other`
 * (held for a human) and the original class is preserved for display/audit.
 */
export function applyConfidenceThreshold(
  slug: Phase5Class,
  confidence: number,
  threshold: number
): { slug: Phase5Class; originalSlug: Phase5Class | null; holdReason: string | null } {
  if (confidence < threshold) {
    return { slug: "other", originalSlug: slug, holdReason: "low_confidence" };
  }
  return { slug, originalSlug: null, holdReason: null };
}

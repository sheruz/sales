/**
 * Phase 5 AI reply agent settings (OrganizationSettings.settings.aiReply).
 */

export type AiReplyModeSetting = "OFF" | "DRAFT_ONLY" | "AUTO_SEND";

export type HoldTriggerId =
  | "pricing"
  | "contract"
  | "payment"
  | "complaint"
  | "uncovered_tech"
  | "call_now"
  | "legal"
  | "non_english";

export type AiReplyConfig = {
  mode: AiReplyModeSetting;
  killSwitch: boolean;
  /** Separate from outbound shadow — when true, never auto-send AI replies */
  shadow: boolean;
  confidenceThreshold: number;
  maxRepliesPerConversation: number;
  /** Per-class auto-send (only when mode=AUTO_SEND). Only interested/question/not_now eligible. */
  autoSendByClass: {
    interested: boolean;
    question: boolean;
    not_now: boolean;
  };
  /** When not_interested: send one-line close vs nothing */
  notInterestedSendClose: boolean;
  holdTriggers: HoldTriggerId[];
  nonEnglishHold: boolean;
  /** Economy model override for classification (optional — uses resolveAiRuntime economy) */
  classifyModel: string;
  /** Quality model override for drafting (optional — uses resolveAiRuntime quality) */
  draftModel: string;
};

export const DEFAULT_HOLD_TRIGGERS: HoldTriggerId[] = [
  "pricing",
  "contract",
  "payment",
  "complaint",
  "uncovered_tech",
  "call_now",
  "legal",
  "non_english",
];

export const DEFAULT_AI_REPLY: AiReplyConfig = {
  mode: "DRAFT_ONLY",
  killSwitch: false,
  shadow: false,
  confidenceThreshold: 0.75,
  maxRepliesPerConversation: 4,
  autoSendByClass: {
    interested: true,
    question: true,
    not_now: true,
  },
  notInterestedSendClose: false,
  holdTriggers: [...DEFAULT_HOLD_TRIGGERS],
  nonEnglishHold: true,
  classifyModel: "",
  draftModel: "",
};

const HOLD_SET = new Set<string>(DEFAULT_HOLD_TRIGGERS);

export function asAiReplyConfig(raw: unknown): AiReplyConfig {
  const s =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>).aiReply
      : null;
  const o =
    s && typeof s === "object" && !Array.isArray(s)
      ? (s as Record<string, unknown>)
      : {};

  const modeRaw = String(o.mode ?? DEFAULT_AI_REPLY.mode).toUpperCase();
  const mode: AiReplyModeSetting =
    modeRaw === "OFF" || modeRaw === "AUTO_SEND" || modeRaw === "DRAFT_ONLY"
      ? modeRaw
      : "DRAFT_ONLY";

  const auto =
    o.autoSendByClass &&
    typeof o.autoSendByClass === "object" &&
    !Array.isArray(o.autoSendByClass)
      ? (o.autoSendByClass as Record<string, unknown>)
      : {};

  const holdTriggers = Array.isArray(o.holdTriggers)
    ? (o.holdTriggers as unknown[])
        .filter((x): x is string => typeof x === "string")
        .filter((x): x is HoldTriggerId => HOLD_SET.has(x))
    : [...DEFAULT_HOLD_TRIGGERS];

  const threshold = Number(
    o.confidenceThreshold ?? DEFAULT_AI_REPLY.confidenceThreshold
  );

  return {
    mode,
    killSwitch: o.killSwitch === true,
    shadow: o.shadow === true,
    confidenceThreshold: Math.min(
      1,
      Math.max(0.1, Number.isFinite(threshold) ? threshold : 0.75)
    ),
    maxRepliesPerConversation: Math.min(
      20,
      Math.max(
        1,
        Number(
          o.maxRepliesPerConversation ??
            DEFAULT_AI_REPLY.maxRepliesPerConversation
        )
      )
    ),
    autoSendByClass: {
      interested: auto.interested !== false,
      question: auto.question !== false,
      not_now: auto.not_now !== false,
    },
    notInterestedSendClose: o.notInterestedSendClose === true,
    holdTriggers,
    nonEnglishHold: o.nonEnglishHold !== false,
    classifyModel:
      typeof o.classifyModel === "string" ? o.classifyModel.trim() : "",
    draftModel: typeof o.draftModel === "string" ? o.draftModel.trim() : "",
  };
}

/** S2 credit action types (match CreditPrice.actionType) */
export const CREDIT_ACTIONS = {
  GOOGLE_SOURCING_PAGE: "google_sourcing_page",
  CRAWL: "crawl",
  ENRICHMENT: "enrichment",
  AUDIT_PITCH: "audit_pitch",
  AI_REPLY_CLASSIFICATION: "ai_reply_classification",
  AI_REPLY_DRAFT: "ai_reply_draft",
  EMAIL_SENT: "email_sent",
  MEETING_BOOKED: "meeting_booked",
} as const;

export type CreditActionType =
  (typeof CREDIT_ACTIONS)[keyof typeof CREDIT_ACTIONS];

export const DEFAULT_CREDIT_PRICES: Array<{
  actionType: CreditActionType;
  byok: number;
  managed: number;
}> = [
  { actionType: CREDIT_ACTIONS.GOOGLE_SOURCING_PAGE, byok: 1, managed: 1 },
  { actionType: CREDIT_ACTIONS.CRAWL, byok: 0, managed: 0 },
  { actionType: CREDIT_ACTIONS.ENRICHMENT, byok: 2, managed: 2 },
  { actionType: CREDIT_ACTIONS.AUDIT_PITCH, byok: 2, managed: 2 },
  { actionType: CREDIT_ACTIONS.AI_REPLY_CLASSIFICATION, byok: 0, managed: 0 },
  { actionType: CREDIT_ACTIONS.AI_REPLY_DRAFT, byok: 1, managed: 1 },
  { actionType: CREDIT_ACTIONS.EMAIL_SENT, byok: 0, managed: 0 },
  { actionType: CREDIT_ACTIONS.MEETING_BOOKED, byok: 0, managed: 0 },
];

/** Jobs paused when enforced org has 0 credits */
export const CREDIT_CONSUMING_ACTIONS = new Set<string>([
  CREDIT_ACTIONS.GOOGLE_SOURCING_PAGE,
  CREDIT_ACTIONS.ENRICHMENT,
  CREDIT_ACTIONS.AUDIT_PITCH,
  CREDIT_ACTIONS.AI_REPLY_DRAFT,
]);

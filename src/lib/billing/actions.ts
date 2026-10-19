/**
 * S2.5 unified billing action catalog.
 * Maps each billable action → feature key, usage metric, credit price key, period.
 */
import { FEATURE_KEYS, type FeatureKey } from "@/lib/billing/features";
import { CREDIT_ACTIONS } from "@/lib/billing/credit-actions";
import type { UsageMetric } from "@prisma/client";

export const BILLING_ACTIONS = {
  GOOGLE_SOURCING_PAGE: "google_sourcing_page",
  CRAWL: "crawl",
  ENRICHMENT: "enrichment",
  AUDIT_PITCH: "audit_pitch",
  AI_REPLY_CLASSIFICATION: "ai_reply_classification",
  AI_REPLY_DRAFT: "ai_reply_draft",
  AI_CALL: "ai_call",
  EMAIL_SEND_AI_REPLY: "email_send_ai_reply",
  EMAIL_SEND_SEQUENCE: "email_send_sequence",
  OPPORTUNITY_CREATE: "opportunity_create",
  MEETING_BOOKED: "meeting_booked",
  SEAT_USERS: "seat_users",
  SEAT_INBOX_ACCOUNTS: "seat_inbox_accounts",
  SEAT_OUTBOUND_MAILBOXES: "seat_outbound_mailboxes",
  SEAT_SEQUENCES: "seat_sequences",
  SEAT_ICPS: "seat_icps",
  SEAT_CAMPAIGNS: "seat_campaigns",
  SEAT_CONNECTORS: "seat_connectors",
} as const;

export type BillingAction =
  (typeof BILLING_ACTIONS)[keyof typeof BILLING_ACTIONS];

export type ActionPeriod = "monthly" | "daily" | "seat" | "none";

export type ActionDef = {
  action: BillingAction;
  featureKey: FeatureKey | string;
  /** UsageRecord metric for committed usage (null = seat-only / no meter) */
  metric: UsageMetric | null;
  /** CreditPrice.actionType; null = never charges credits */
  creditActionType: string | null;
  period: ActionPeriod;
  /** Also enforce daily email cap (EMAILS_DAILY) */
  dailyEmail: boolean;
  /** Always allow; meter only */
  alwaysExempt: boolean;
  /** Counts toward AI_CALLS when committed */
  countsAiCalls: boolean;
};

const defs: ActionDef[] = [
  {
    action: BILLING_ACTIONS.GOOGLE_SOURCING_PAGE,
    featureKey: FEATURE_KEYS.SOURCES,
    metric: "SOURCE_CALLS",
    creditActionType: CREDIT_ACTIONS.GOOGLE_SOURCING_PAGE,
    period: "monthly",
    dailyEmail: false,
    alwaysExempt: false,
    countsAiCalls: false,
  },
  {
    action: BILLING_ACTIONS.CRAWL,
    featureKey: FEATURE_KEYS.CRAWLS,
    metric: "CRAWLS",
    creditActionType: CREDIT_ACTIONS.CRAWL,
    period: "monthly",
    dailyEmail: false,
    alwaysExempt: false,
    countsAiCalls: false,
  },
  {
    action: BILLING_ACTIONS.ENRICHMENT,
    featureKey: FEATURE_KEYS.ENRICHMENT,
    metric: "ENRICHMENT",
    creditActionType: CREDIT_ACTIONS.ENRICHMENT,
    period: "monthly",
    dailyEmail: false,
    alwaysExempt: false,
    countsAiCalls: false,
  },
  {
    action: BILLING_ACTIONS.AUDIT_PITCH,
    featureKey: FEATURE_KEYS.AUDITS,
    metric: "AUDITS",
    creditActionType: CREDIT_ACTIONS.AUDIT_PITCH,
    period: "monthly",
    dailyEmail: false,
    alwaysExempt: false,
    countsAiCalls: false,
  },
  {
    action: BILLING_ACTIONS.AI_REPLY_CLASSIFICATION,
    featureKey: FEATURE_KEYS.AI_CALLS,
    metric: "AI_CALLS",
    creditActionType: CREDIT_ACTIONS.AI_REPLY_CLASSIFICATION,
    period: "none",
    dailyEmail: false,
    alwaysExempt: true,
    countsAiCalls: true,
  },
  {
    action: BILLING_ACTIONS.AI_REPLY_DRAFT,
    featureKey: FEATURE_KEYS.AI_CALLS,
    metric: "AI_CALLS",
    creditActionType: CREDIT_ACTIONS.AI_REPLY_DRAFT,
    period: "monthly",
    dailyEmail: false,
    alwaysExempt: false,
    countsAiCalls: true,
  },
  {
    action: BILLING_ACTIONS.AI_CALL,
    featureKey: FEATURE_KEYS.AI_CALLS,
    metric: "AI_CALLS",
    creditActionType: null,
    period: "monthly",
    dailyEmail: false,
    alwaysExempt: false,
    countsAiCalls: true,
  },
  {
    action: BILLING_ACTIONS.EMAIL_SEND_AI_REPLY,
    featureKey: FEATURE_KEYS.EMAILS,
    metric: "EMAILS",
    creditActionType: null,
    period: "monthly",
    dailyEmail: true,
    alwaysExempt: false,
    countsAiCalls: false,
  },
  {
    action: BILLING_ACTIONS.EMAIL_SEND_SEQUENCE,
    featureKey: FEATURE_KEYS.EMAILS,
    metric: "EMAILS",
    creditActionType: null,
    period: "monthly",
    dailyEmail: true,
    alwaysExempt: false,
    countsAiCalls: false,
  },
  {
    action: BILLING_ACTIONS.OPPORTUNITY_CREATE,
    featureKey: FEATURE_KEYS.OPPORTUNITIES,
    metric: "OPPORTUNITIES",
    creditActionType: null,
    period: "monthly",
    dailyEmail: false,
    alwaysExempt: false,
    countsAiCalls: false,
  },
  {
    action: BILLING_ACTIONS.MEETING_BOOKED,
    featureKey: FEATURE_KEYS.MEETINGS,
    metric: "MEETINGS",
    creditActionType: CREDIT_ACTIONS.MEETING_BOOKED,
    period: "monthly",
    dailyEmail: false,
    alwaysExempt: false,
    countsAiCalls: false,
  },
  {
    action: BILLING_ACTIONS.SEAT_USERS,
    featureKey: FEATURE_KEYS.USERS,
    metric: null,
    creditActionType: null,
    period: "seat",
    dailyEmail: false,
    alwaysExempt: false,
    countsAiCalls: false,
  },
  {
    action: BILLING_ACTIONS.SEAT_INBOX_ACCOUNTS,
    featureKey: FEATURE_KEYS.INBOX_ACCOUNTS,
    metric: null,
    creditActionType: null,
    period: "seat",
    dailyEmail: false,
    alwaysExempt: false,
    countsAiCalls: false,
  },
  {
    action: BILLING_ACTIONS.SEAT_OUTBOUND_MAILBOXES,
    featureKey: FEATURE_KEYS.OUTBOUND_MAILBOXES,
    metric: null,
    creditActionType: null,
    period: "seat",
    dailyEmail: false,
    alwaysExempt: false,
    countsAiCalls: false,
  },
  {
    action: BILLING_ACTIONS.SEAT_SEQUENCES,
    featureKey: FEATURE_KEYS.SEQUENCES,
    metric: null,
    creditActionType: null,
    period: "seat",
    dailyEmail: false,
    alwaysExempt: false,
    countsAiCalls: false,
  },
  {
    action: BILLING_ACTIONS.SEAT_ICPS,
    featureKey: FEATURE_KEYS.ICPS,
    metric: null,
    creditActionType: null,
    period: "seat",
    dailyEmail: false,
    alwaysExempt: false,
    countsAiCalls: false,
  },
  {
    action: BILLING_ACTIONS.SEAT_CAMPAIGNS,
    featureKey: FEATURE_KEYS.CAMPAIGNS,
    metric: null,
    creditActionType: null,
    period: "seat",
    dailyEmail: false,
    alwaysExempt: false,
    countsAiCalls: false,
  },
  {
    action: BILLING_ACTIONS.SEAT_CONNECTORS,
    featureKey: FEATURE_KEYS.CONNECTORS,
    metric: null,
    creditActionType: null,
    period: "seat",
    dailyEmail: false,
    alwaysExempt: false,
    countsAiCalls: false,
  },
];

const byAction = new Map(defs.map((d) => [d.action, d]));

export function getActionDef(action: string): ActionDef | null {
  return byAction.get(action as BillingAction) ?? null;
}

export function listActionDefs(): ActionDef[] {
  return [...defs];
}

/** Map inbound AI purposes → always-exempt classification action */
export const INBOUND_EXEMPT_PURPOSES = new Set([
  "inbox_reply_classification",
  "bounce_detection",
  "unsub_detection",
  "suppression",
  "reply_classification",
]);

export function resolveAiBillingAction(purpose: string): BillingAction {
  if (INBOUND_EXEMPT_PURPOSES.has(purpose)) {
    return BILLING_ACTIONS.AI_REPLY_CLASSIFICATION;
  }
  if (purpose === "ai_reply_draft" || purpose === "inbox_reply_draft") {
    return BILLING_ACTIONS.AI_REPLY_DRAFT;
  }
  return BILLING_ACTIONS.AI_CALL;
}

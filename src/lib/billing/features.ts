/**
 * Feature key registry only — never store limit values here for runtime.
 * Package limits/modules live in PlanVersionFeature (DB).
 * DEFAULT_PLANS is legacy seed data for empty DBs / old tests; B1 seeds use scripts/b1-plan-catalog.js.
 */

export const FEATURE_KEYS = {
  USERS: "users",
  OPPORTUNITIES: "opportunities",
  AI_CALLS: "ai_calls",
  EMAILS: "emails",
  EMAILS_DAILY: "emails_daily",
  SEQUENCES: "sequences",
  SOURCES: "sources",
  ENRICHMENT: "enrichment",
  AUDITS: "audits",
  CRAWLS: "crawls",
  MEETINGS: "meetings",
  INBOX_ACCOUNTS: "inbox_accounts",
  OUTBOUND_MAILBOXES: "outbound_mailboxes",
  AUTOMATION: "automation",
  ADVANCED_AI: "advanced_ai",
  LEARNING: "learning",
  CONNECTORS: "connectors",
  ICPS: "icps",
  CAMPAIGNS: "campaigns",
  // B1 module keys (also PlanVersionFeature rows)
  DASHBOARD: "dashboard",
  LEADS: "leads",
  AUTOPILOT_SOURCING: "autopilot_sourcing",
  AUTOPILOT_ENRICHMENT: "autopilot_enrichment",
  AUTOPILOT_AUDIT: "autopilot_audit",
  /** PoW deep audit + preview outreach (Pro / Agency) */
  PROOF_OF_WORK: "proof_of_work",
  OUTREACH: "outreach",
  INBOX: "inbox",
  AI_REPLIES: "ai_replies",
  AI_AUTO_SEND: "ai_auto_send",
  DEALS: "deals",
  META_LEAD_ADS: "meta_lead_ads",
  LINKEDIN_ASSIST: "linkedin_assist",
  ANALYTICS_ADVANCED: "analytics_advanced",
  WHITE_LABEL: "white_label",
  API_ACCESS: "api_access",
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

export const FEATURE_KEY_LABELS: Record<string, string> = {
  [FEATURE_KEYS.USERS]: "Users",
  [FEATURE_KEYS.OPPORTUNITIES]: "Opportunities",
  [FEATURE_KEYS.AI_CALLS]: "AI calls",
  [FEATURE_KEYS.EMAILS]: "Emails / month",
  [FEATURE_KEYS.EMAILS_DAILY]: "Emails / day",
  [FEATURE_KEYS.SEQUENCES]: "Sequences",
  [FEATURE_KEYS.SOURCES]: "Sources",
  [FEATURE_KEYS.ENRICHMENT]: "Enrichment",
  [FEATURE_KEYS.AUDITS]: "Audits",
  [FEATURE_KEYS.CRAWLS]: "Crawls",
  [FEATURE_KEYS.MEETINGS]: "Meetings",
  [FEATURE_KEYS.INBOX_ACCOUNTS]: "Inbox accounts",
  [FEATURE_KEYS.OUTBOUND_MAILBOXES]: "Sending mailboxes",
  [FEATURE_KEYS.AUTOMATION]: "Automation",
  [FEATURE_KEYS.ADVANCED_AI]: "Advanced AI",
  [FEATURE_KEYS.LEARNING]: "Learning",
  [FEATURE_KEYS.CONNECTORS]: "Connectors",
  [FEATURE_KEYS.ICPS]: "ICPs",
  [FEATURE_KEYS.CAMPAIGNS]: "Campaigns",
  [FEATURE_KEYS.DASHBOARD]: "Dashboard",
  [FEATURE_KEYS.LEADS]: "Leads",
  [FEATURE_KEYS.AUTOPILOT_SOURCING]: "Autopilot sourcing",
  [FEATURE_KEYS.AUTOPILOT_ENRICHMENT]: "Enrichment",
  [FEATURE_KEYS.AUTOPILOT_AUDIT]: "Audit + pitch",
  [FEATURE_KEYS.PROOF_OF_WORK]: "Proof-of-work outreach",
  [FEATURE_KEYS.OUTREACH]: "Outreach",
  [FEATURE_KEYS.INBOX]: "Inbox",
  [FEATURE_KEYS.AI_REPLIES]: "AI reply drafts",
  [FEATURE_KEYS.AI_AUTO_SEND]: "AI auto-send",
  [FEATURE_KEYS.DEALS]: "Deals",
  [FEATURE_KEYS.META_LEAD_ADS]: "Meta Lead Ads",
  [FEATURE_KEYS.LINKEDIN_ASSIST]: "LinkedIn assist",
  [FEATURE_KEYS.ANALYTICS_ADVANCED]: "Advanced analytics",
  [FEATURE_KEYS.WHITE_LABEL]: "White-label",
  [FEATURE_KEYS.API_ACCESS]: "API access",
};

export function isKnownFeatureKey(key: string): boolean {
  return Object.values(FEATURE_KEYS).includes(key as FeatureKey);
}

/** @deprecated Seed-only legacy Free/Growth/Scale. Runtime must not use these limits. */
type PlanFeatureSeed = {
  featureKey: FeatureKey;
  limitValue: number | null;
  enabled: boolean;
};

function freeFeatures(): PlanFeatureSeed[] {
  return [
    { featureKey: FEATURE_KEYS.USERS, limitValue: 2, enabled: true },
    { featureKey: FEATURE_KEYS.OPPORTUNITIES, limitValue: 50, enabled: true },
    { featureKey: FEATURE_KEYS.AI_CALLS, limitValue: 100, enabled: true },
    { featureKey: FEATURE_KEYS.EMAILS, limitValue: 100, enabled: true },
    { featureKey: FEATURE_KEYS.EMAILS_DAILY, limitValue: 50, enabled: true },
    { featureKey: FEATURE_KEYS.SEQUENCES, limitValue: 1, enabled: true },
    { featureKey: FEATURE_KEYS.SOURCES, limitValue: 2, enabled: true },
    { featureKey: FEATURE_KEYS.ENRICHMENT, limitValue: 25, enabled: true },
    { featureKey: FEATURE_KEYS.AUDITS, limitValue: 25, enabled: true },
    { featureKey: FEATURE_KEYS.CRAWLS, limitValue: 100, enabled: true },
    { featureKey: FEATURE_KEYS.MEETINGS, limitValue: 50, enabled: true },
    { featureKey: FEATURE_KEYS.INBOX_ACCOUNTS, limitValue: 1, enabled: true },
    { featureKey: FEATURE_KEYS.OUTBOUND_MAILBOXES, limitValue: 1, enabled: true },
    { featureKey: FEATURE_KEYS.AUTOMATION, limitValue: 1, enabled: true },
    { featureKey: FEATURE_KEYS.ADVANCED_AI, limitValue: 0, enabled: false },
    { featureKey: FEATURE_KEYS.LEARNING, limitValue: 0, enabled: false },
    { featureKey: FEATURE_KEYS.CONNECTORS, limitValue: 2, enabled: true },
    { featureKey: FEATURE_KEYS.ICPS, limitValue: 3, enabled: true },
    { featureKey: FEATURE_KEYS.CAMPAIGNS, limitValue: 2, enabled: true },
  ];
}

function growthFeatures(): PlanFeatureSeed[] {
  return [
    { featureKey: FEATURE_KEYS.USERS, limitValue: 10, enabled: true },
    { featureKey: FEATURE_KEYS.OPPORTUNITIES, limitValue: 1000, enabled: true },
    { featureKey: FEATURE_KEYS.AI_CALLS, limitValue: 2000, enabled: true },
    { featureKey: FEATURE_KEYS.EMAILS, limitValue: 5000, enabled: true },
    { featureKey: FEATURE_KEYS.EMAILS_DAILY, limitValue: 200, enabled: true },
    { featureKey: FEATURE_KEYS.SEQUENCES, limitValue: 20, enabled: true },
    { featureKey: FEATURE_KEYS.SOURCES, limitValue: 10, enabled: true },
    { featureKey: FEATURE_KEYS.ENRICHMENT, limitValue: 1000, enabled: true },
    { featureKey: FEATURE_KEYS.AUDITS, limitValue: 1000, enabled: true },
    { featureKey: FEATURE_KEYS.CRAWLS, limitValue: 5000, enabled: true },
    { featureKey: FEATURE_KEYS.MEETINGS, limitValue: 500, enabled: true },
    { featureKey: FEATURE_KEYS.INBOX_ACCOUNTS, limitValue: 5, enabled: true },
    { featureKey: FEATURE_KEYS.OUTBOUND_MAILBOXES, limitValue: 5, enabled: true },
    { featureKey: FEATURE_KEYS.AUTOMATION, limitValue: 10, enabled: true },
    { featureKey: FEATURE_KEYS.ADVANCED_AI, limitValue: 1, enabled: true },
    { featureKey: FEATURE_KEYS.LEARNING, limitValue: 1, enabled: true },
    { featureKey: FEATURE_KEYS.CONNECTORS, limitValue: 10, enabled: true },
    { featureKey: FEATURE_KEYS.ICPS, limitValue: 20, enabled: true },
    { featureKey: FEATURE_KEYS.CAMPAIGNS, limitValue: 20, enabled: true },
  ];
}

function scaleFeatures(): PlanFeatureSeed[] {
  return [
    { featureKey: FEATURE_KEYS.USERS, limitValue: 50, enabled: true },
    { featureKey: FEATURE_KEYS.OPPORTUNITIES, limitValue: 10000, enabled: true },
    { featureKey: FEATURE_KEYS.AI_CALLS, limitValue: 20000, enabled: true },
    { featureKey: FEATURE_KEYS.EMAILS, limitValue: 50000, enabled: true },
    { featureKey: FEATURE_KEYS.EMAILS_DAILY, limitValue: 1000, enabled: true },
    { featureKey: FEATURE_KEYS.SEQUENCES, limitValue: 100, enabled: true },
    { featureKey: FEATURE_KEYS.SOURCES, limitValue: 50, enabled: true },
    { featureKey: FEATURE_KEYS.ENRICHMENT, limitValue: 10000, enabled: true },
    { featureKey: FEATURE_KEYS.AUDITS, limitValue: 10000, enabled: true },
    { featureKey: FEATURE_KEYS.CRAWLS, limitValue: 50000, enabled: true },
    { featureKey: FEATURE_KEYS.MEETINGS, limitValue: 5000, enabled: true },
    { featureKey: FEATURE_KEYS.INBOX_ACCOUNTS, limitValue: 25, enabled: true },
    { featureKey: FEATURE_KEYS.OUTBOUND_MAILBOXES, limitValue: 25, enabled: true },
    { featureKey: FEATURE_KEYS.AUTOMATION, limitValue: 100, enabled: true },
    { featureKey: FEATURE_KEYS.ADVANCED_AI, limitValue: 1, enabled: true },
    { featureKey: FEATURE_KEYS.LEARNING, limitValue: 1, enabled: true },
    { featureKey: FEATURE_KEYS.CONNECTORS, limitValue: 50, enabled: true },
    { featureKey: FEATURE_KEYS.ICPS, limitValue: 100, enabled: true },
    { featureKey: FEATURE_KEYS.CAMPAIGNS, limitValue: 100, enabled: true },
  ];
}

/** OWNER plan features — unlimited; seed scripts only */
export function ownerPlanFeatures(): PlanFeatureSeed[] {
  return Object.values(FEATURE_KEYS).map((featureKey) => ({
    featureKey,
    limitValue: null,
    enabled: true,
  }));
}

/** @deprecated Prefer scripts/b1-plan-catalog.js. Kept for entitlement.ensureDefaultPlans empty-DB bootstrap. */
export const DEFAULT_PLANS = [
  {
    name: "Free",
    description: "Get started with core opportunity and outreach tools",
    price: 0,
    currency: "USD",
    billingInterval: "MONTHLY" as const,
    isDefault: true,
    sortOrder: 0,
    features: freeFeatures(),
  },
  {
    name: "Growth",
    description: "For growing sales teams running multi-source pipeline",
    price: 99,
    currency: "USD",
    billingInterval: "MONTHLY" as const,
    isDefault: false,
    sortOrder: 1,
    features: growthFeatures(),
  },
  {
    name: "Scale",
    description: "Unlimited-leaning entitlements for revenue teams",
    price: 299,
    currency: "USD",
    billingInterval: "MONTHLY" as const,
    isDefault: false,
    sortOrder: 2,
    features: scaleFeatures(),
  },
] as const;

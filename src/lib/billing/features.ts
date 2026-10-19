/** Feature keys enforced server-side against plan_features.limit_value */
export const FEATURE_KEYS = {
  USERS: "users",
  OPPORTUNITIES: "opportunities",
  AI_CALLS: "ai_calls",
  EMAILS: "emails",
  /** Plan ceiling for daily outbound emails (tenant may only lower via settings) */
  EMAILS_DAILY: "emails_daily",
  SEQUENCES: "sequences",
  SOURCES: "sources",
  ENRICHMENT: "enrichment",
  AUDITS: "audits",
  CRAWLS: "crawls",
  MEETINGS: "meetings",
  INBOX_ACCOUNTS: "inbox_accounts",
  /** Explicit opt-in cold-outbound pool seats (OutboundMailbox rows). */
  OUTBOUND_MAILBOXES: "outbound_mailboxes",
  AUTOMATION: "automation",
  ADVANCED_AI: "advanced_ai",
  LEARNING: "learning",
  CONNECTORS: "connectors",
  ICPS: "icps",
  CAMPAIGNS: "campaigns",
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

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

/** OWNER plan features — unlimited; never assignable to tenants */
export function ownerPlanFeatures(): PlanFeatureSeed[] {
  return Object.values(FEATURE_KEYS).map((featureKey) => ({
    featureKey,
    limitValue: null,
    enabled: true,
  }));
}

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

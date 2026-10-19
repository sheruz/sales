/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * B1 package catalog — source of truth for seed scripts.
 * Aligns with docs/tenant-lifecycle-billing-spec.md §5.
 * CommonJS only (used by b1-apply / b1-dry-run).
 */

/** Module feature keys from §6 gating map */
const MODULE_KEYS = [
  "dashboard",
  "leads",
  "autopilot_sourcing",
  "autopilot_enrichment",
  "autopilot_audit",
  "outreach",
  "inbox",
  "ai_replies",
  "ai_auto_send",
  "meetings",
  "deals",
  "meta_lead_ads",
  "linkedin_assist",
  "analytics_advanced",
  "white_label",
  "api_access",
];

/** Limit / seat keys (plus module keys that also carry limits) */
const LIMIT_KEYS = [
  "users",
  "outbound_mailboxes",
  "emails_daily",
  "emails",
  "icps",
  "campaigns",
  "sources",
  "enrichment",
  "audits",
  "crawls",
  "meetings",
  "opportunities",
  "ai_calls",
  "sequences",
  "inbox_accounts",
  "automation",
  "advanced_ai",
  "learning",
  "connectors",
];

function feat(enabled, limitValue = null) {
  return { enabled: Boolean(enabled), limitValue };
}

/** Unlimited = null limit, enabled true */
function unlimited() {
  return feat(true, null);
}

function off() {
  return feat(false, 0);
}

/**
 * Build feature map: every MODULE_KEY + LIMIT_KEY present.
 * Module-only keys without a limit use enabled flag; limit keys use limitValue.
 */
function buildFeatures(modules, limits) {
  const out = {};
  for (const key of MODULE_KEYS) {
    out[key] = modules[key] != null ? modules[key] : off();
  }
  for (const key of LIMIT_KEYS) {
    if (out[key] != null && limits[key] == null) continue;
    out[key] = limits[key] != null ? limits[key] : off();
  }
  return out;
}

const STARTER_MODULES = {
  dashboard: feat(true),
  leads: feat(true),
  autopilot_sourcing: feat(true),
  autopilot_enrichment: feat(true),
  autopilot_audit: feat(true),
  outreach: feat(true),
  inbox: feat(true),
  ai_replies: feat(true),
  ai_auto_send: off(),
  meetings: off(),
  deals: feat(true),
  meta_lead_ads: off(),
  linkedin_assist: off(),
  analytics_advanced: off(), // Basic analytics only — advanced off
  white_label: off(),
  api_access: off(),
};

const STARTER_LIMITS = {
  users: feat(true, 1),
  outbound_mailboxes: feat(true, 2),
  emails_daily: feat(true, 60),
  emails: feat(true, 1500),
  icps: feat(true, 1),
  campaigns: feat(true, 2),
  sources: feat(true, 2),
  enrichment: feat(true, 150),
  audits: feat(true, 150),
  crawls: feat(true, 600),
  meetings: off(),
  opportunities: feat(true, 100),
  ai_calls: feat(true, 300),
  sequences: feat(true, 2),
  inbox_accounts: feat(true, 2),
  automation: feat(true, 2),
  advanced_ai: off(),
  learning: off(),
  connectors: feat(true, 2),
};

const GROWTH_MODULES = {
  ...STARTER_MODULES,
  ai_auto_send: feat(true),
  meetings: feat(true),
  meta_lead_ads: feat(true),
  linkedin_assist: feat(true),
  analytics_advanced: feat(true),
  white_label: off(),
  api_access: off(),
};

const GROWTH_LIMITS = {
  users: feat(true, 3),
  outbound_mailboxes: feat(true, 5),
  emails_daily: feat(true, 250),
  emails: feat(true, 6000),
  icps: feat(true, 3),
  campaigns: feat(true, 10),
  sources: feat(true, 5),
  enrichment: feat(true, 500),
  audits: feat(true, 500),
  crawls: feat(true, 2000),
  meetings: feat(true, 100),
  opportunities: feat(true, 500),
  ai_calls: feat(true, 1000),
  sequences: feat(true, 10),
  inbox_accounts: feat(true, 5),
  automation: feat(true, 10),
  advanced_ai: feat(true, 1),
  learning: feat(true, 1),
  connectors: feat(true, 5),
};

const PRO_MODULES = {
  ...GROWTH_MODULES,
  // personal audit pages (Signal engine) — later; not a seeded key yet → leave off
  white_label: off(),
  api_access: off(),
};

const PRO_LIMITS = {
  users: feat(true, 10),
  outbound_mailboxes: feat(true, 15),
  emails_daily: feat(true, 750),
  emails: feat(true, 18000),
  icps: feat(true, 10),
  campaigns: feat(true, 30),
  sources: feat(true, 15),
  enrichment: feat(true, 1250),
  audits: feat(true, 1250),
  crawls: feat(true, 5000),
  meetings: feat(true, 500),
  opportunities: feat(true, 2000),
  ai_calls: feat(true, 3000),
  sequences: feat(true, 30),
  inbox_accounts: feat(true, 15),
  automation: feat(true, 30),
  advanced_ai: feat(true, 1),
  learning: feat(true, 1),
  connectors: feat(true, 15),
};

const AGENCY_MODULES = {
  dashboard: feat(true),
  leads: feat(true),
  autopilot_sourcing: feat(true),
  autopilot_enrichment: feat(true),
  autopilot_audit: feat(true),
  outreach: feat(true),
  inbox: feat(true),
  ai_replies: feat(true),
  ai_auto_send: feat(true),
  meetings: feat(true),
  deals: feat(true),
  meta_lead_ads: feat(true),
  linkedin_assist: feat(true),
  analytics_advanced: feat(true),
  white_label: feat(true),
  api_access: feat(true),
};

const AGENCY_LIMITS = {
  users: feat(true, 25),
  outbound_mailboxes: feat(true, 40),
  emails_daily: feat(true, 2000),
  emails: feat(true, 50000),
  icps: unlimited(),
  campaigns: unlimited(),
  sources: feat(true, 50),
  enrichment: feat(true, 3000),
  audits: feat(true, 3000),
  crawls: feat(true, 12000),
  meetings: feat(true, 2000),
  opportunities: unlimited(),
  ai_calls: unlimited(),
  sequences: unlimited(),
  inbox_accounts: feat(true, 40),
  automation: unlimited(),
  advanced_ai: feat(true, 1),
  learning: feat(true, 1),
  connectors: feat(true, 50),
};

/** All keys unlimited / enabled — OWNER */
function allUnlimitedFeatures() {
  const out = {};
  const keys = new Set([...MODULE_KEYS, ...LIMIT_KEYS]);
  for (const key of keys) {
    out[key] = unlimited();
  }
  return out;
}

/** Locked / no package — all off */
function allOffFeatures() {
  const out = {};
  const keys = new Set([...MODULE_KEYS, ...LIMIT_KEYS]);
  for (const key of keys) {
    out[key] = off();
  }
  return out;
}

/**
 * @typedef {{
 *   code: string,
 *   name: string,
 *   description: string,
 *   visibility: 'PUBLIC'|'PRIVATE'|'INTERNAL'|'DRAFT',
 *   mostPopular: boolean,
 *   sortOrder: number,
 *   isDefault: boolean,
 *   internal: boolean,
 *   priceMonthly: number,
 *   priceYearly: number,
 *   monthlyCredits: number|null,
 *   creditRolloverEnabled: boolean,
 *   creditRolloverCapMonths: number|null,
 *   features: Record<string, { enabled: boolean, limitValue: number|null }>
 * }} PlanDef
 */

/** @type {PlanDef[]} */
const B1_PLAN_CATALOG = [
  {
    code: "STARTER",
    name: "Starter",
    description: "For freelancers starting outbound",
    visibility: "PUBLIC",
    mostPopular: false,
    sortOrder: 10,
    isDefault: false,
    internal: false,
    priceMonthly: 49,
    priceYearly: 490,
    monthlyCredits: 600,
    creditRolloverEnabled: false,
    creditRolloverCapMonths: null,
    features: buildFeatures(STARTER_MODULES, STARTER_LIMITS),
  },
  {
    code: "GROWTH",
    name: "Growth",
    description: "Autopilot that replies and books meetings",
    visibility: "PUBLIC",
    mostPopular: true,
    sortOrder: 20,
    isDefault: true,
    internal: false,
    priceMonthly: 149,
    priceYearly: 1490,
    monthlyCredits: 2000,
    creditRolloverEnabled: true,
    creditRolloverCapMonths: 1,
    features: buildFeatures(GROWTH_MODULES, GROWTH_LIMITS),
  },
  {
    code: "PRO",
    name: "Pro",
    description: "For growing agencies with higher volume",
    visibility: "PUBLIC",
    mostPopular: false,
    sortOrder: 30,
    isDefault: false,
    internal: false,
    priceMonthly: 299,
    priceYearly: 2990,
    monthlyCredits: 5000,
    creditRolloverEnabled: true,
    creditRolloverCapMonths: 1,
    features: buildFeatures(PRO_MODULES, PRO_LIMITS),
  },
  {
    code: "AGENCY",
    name: "Agency",
    description: "White-label + API for agencies serving clients",
    visibility: "PUBLIC",
    mostPopular: false,
    sortOrder: 40,
    isDefault: false,
    internal: false,
    priceMonthly: 599,
    priceYearly: 5990,
    monthlyCredits: 12000,
    creditRolloverEnabled: true,
    creditRolloverCapMonths: 2,
    features: buildFeatures(AGENCY_MODULES, AGENCY_LIMITS),
  },
  {
    code: "UNASSIGNED",
    name: "Unassigned",
    description: "Internal: no package yet (locked Choose Plan)",
    visibility: "INTERNAL",
    mostPopular: false,
    sortOrder: 0,
    isDefault: false,
    internal: true,
    priceMonthly: 0,
    priceYearly: 0,
    monthlyCredits: 0,
    creditRolloverEnabled: false,
    creditRolloverCapMonths: null,
    features: allOffFeatures(),
  },
  {
    code: "OWNER",
    name: "OWNER",
    description: "Internal: Delvix platform owner — unlimited, never billed",
    visibility: "INTERNAL",
    mostPopular: false,
    sortOrder: 1000,
    isDefault: false,
    internal: true,
    priceMonthly: 0,
    priceYearly: 0,
    monthlyCredits: null,
    creditRolloverEnabled: false,
    creditRolloverCapMonths: null,
    features: allUnlimitedFeatures(),
  },
  {
    code: "COMPLIMENTARY",
    name: "Complimentary",
    description: "Internal: partners/testing — Agency features, no charge",
    visibility: "INTERNAL",
    mostPopular: false,
    sortOrder: 50,
    isDefault: false,
    internal: true,
    priceMonthly: 0,
    priceYearly: 0,
    monthlyCredits: 12000,
    creditRolloverEnabled: true,
    creditRolloverCapMonths: 2,
    features: buildFeatures(AGENCY_MODULES, AGENCY_LIMITS),
  },
];

const LEGACY_PLAN_NAMES = ["Free", "Growth", "Scale"];
const LEGACY_PLAN_CODES = ["FREE", "SCALE"];
/** Catalog codes that must not be archived even if name matches legacy Growth */
const CATALOG_CODES = B1_PLAN_CATALOG.map((p) => p.code);

function featuresToRows(features) {
  return Object.entries(features).map(([featureKey, v]) => ({
    featureKey,
    enabled: v.enabled,
    limitValue: v.limitValue,
  }));
}

module.exports = {
  MODULE_KEYS,
  LIMIT_KEYS,
  B1_PLAN_CATALOG,
  LEGACY_PLAN_NAMES,
  LEGACY_PLAN_CODES,
  CATALOG_CODES,
  featuresToRows,
  buildFeatures,
  feat,
  unlimited,
  off,
};

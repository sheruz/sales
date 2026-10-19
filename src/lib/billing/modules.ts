/**
 * B1 module catalog — single source of truth for nav lock, page guard,
 * API guard (requireModule), and job tags. Limit values live in PlanVersionFeature.
 */

import { FEATURE_KEYS, type FeatureKey } from "@/lib/billing/features";

export const MODULE_KEYS = {
  DASHBOARD: "dashboard",
  LEADS: "leads",
  AUTOPILOT_SOURCING: "autopilot_sourcing",
  AUTOPILOT_ENRICHMENT: "autopilot_enrichment",
  AUTOPILOT_AUDIT: "autopilot_audit",
  OUTREACH: "outreach",
  INBOX: "inbox",
  AI_REPLIES: "ai_replies",
  AI_AUTO_SEND: "ai_auto_send",
  MEETINGS: "meetings",
  DEALS: "deals",
  META_LEAD_ADS: "meta_lead_ads",
  LINKEDIN_ASSIST: "linkedin_assist",
  ANALYTICS_ADVANCED: "analytics_advanced",
  WHITE_LABEL: "white_label",
  API_ACCESS: "api_access",
} as const;

export type ModuleKey = (typeof MODULE_KEYS)[keyof typeof MODULE_KEYS];

/** All module feature keys (also registered in FEATURE_KEYS). */
export const MODULE_FEATURE_KEYS: ModuleKey[] = Object.values(MODULE_KEYS);

export type ModuleDef = {
  key: ModuleKey;
  label: string;
  /** Short nav label */
  navLabel: string;
  /** Lowest public plan that includes this module (for upgrade copy) */
  availableOn: "Starter" | "Growth" | "Pro" | "Agency";
  /** Path prefixes under /dashboard (no leading slash duplication) */
  pagePrefixes: string[];
  /** API path prefixes under /api */
  apiPrefixes: string[];
  /** Job tags used by cron guards */
  jobTags: string[];
  /** Show in main app sidebar */
  showInNav?: boolean;
};

export const MODULE_CATALOG: ModuleDef[] = [
  {
    key: MODULE_KEYS.DASHBOARD,
    label: "Home",
    navLabel: "Home",
    availableOn: "Starter",
    pagePrefixes: [""],
    apiPrefixes: ["/api/dashboard"],
    jobTags: [],
    showInNav: true,
  },
  {
    key: MODULE_KEYS.LEADS,
    label: "Leads",
    navLabel: "Leads",
    availableOn: "Starter",
    pagePrefixes: ["/companies", "/contacts", "/leads"],
    apiPrefixes: ["/api/companies", "/api/contacts", "/api/leads"],
    jobTags: [],
    showInNav: true,
  },
  {
    key: MODULE_KEYS.AUTOPILOT_SOURCING,
    label: "Autopilot sourcing",
    navLabel: "Autopilot",
    availableOn: "Starter",
    pagePrefixes: ["/autopilot", "/sources"],
    apiPrefixes: ["/api/sourcing", "/api/sources", "/api/autopilot"],
    jobTags: ["sourcing", "crawl"],
    showInNav: true,
  },
  {
    key: MODULE_KEYS.AUTOPILOT_ENRICHMENT,
    label: "Enrichment",
    navLabel: "Enrichment",
    availableOn: "Starter",
    pagePrefixes: [],
    apiPrefixes: ["/api/enrichment"],
    jobTags: ["enrichment"],
  },
  {
    key: MODULE_KEYS.AUTOPILOT_AUDIT,
    label: "Website audit + pitch",
    navLabel: "Audit",
    availableOn: "Starter",
    pagePrefixes: [],
    apiPrefixes: ["/api/audits", "/api/pitches", "/api/website-audit"],
    jobTags: ["audit"],
  },
  {
    key: MODULE_KEYS.OUTREACH,
    label: "Outreach",
    navLabel: "Outreach",
    availableOn: "Starter",
    pagePrefixes: ["/outreach", "/campaigns", "/sequences"],
    apiPrefixes: [
      "/api/outreach",
      "/api/campaigns",
      "/api/sequences",
      "/api/autopilot/outbound",
    ],
    jobTags: ["outbound", "sequences"],
    showInNav: true,
  },
  {
    key: MODULE_KEYS.INBOX,
    label: "Inbox",
    navLabel: "Inbox",
    availableOn: "Starter",
    pagePrefixes: ["/conversations"],
    apiPrefixes: ["/api/inbox", "/api/conversations"],
    jobTags: ["inbox_sync"],
    showInNav: true,
  },
  {
    key: MODULE_KEYS.AI_REPLIES,
    label: "AI reply drafts",
    navLabel: "AI replies",
    availableOn: "Starter",
    pagePrefixes: [],
    apiPrefixes: ["/api/ai-replies", "/api/ai-reply"],
    jobTags: ["ai_replies"],
  },
  {
    key: MODULE_KEYS.AI_AUTO_SEND,
    label: "AI auto-send replies",
    navLabel: "AI auto-send",
    availableOn: "Growth",
    pagePrefixes: [],
    apiPrefixes: [],
    jobTags: ["ai_auto_send"],
  },
  {
    key: MODULE_KEYS.MEETINGS,
    label: "Meetings",
    navLabel: "Meetings",
    availableOn: "Growth",
    pagePrefixes: ["/meetings"],
    apiPrefixes: ["/api/meetings"],
    jobTags: ["meetings"],
    showInNav: true,
  },
  {
    key: MODULE_KEYS.DEALS,
    label: "Deals",
    navLabel: "Deals",
    availableOn: "Starter",
    pagePrefixes: ["/pipeline", "/opportunities", "/proposals"],
    apiPrefixes: [
      "/api/pipeline",
      "/api/opportunities",
      "/api/proposals",
      "/api/deals",
    ],
    jobTags: [],
    showInNav: true,
  },
  {
    key: MODULE_KEYS.META_LEAD_ADS,
    label: "Meta Lead Ads",
    navLabel: "Meta",
    availableOn: "Growth",
    pagePrefixes: [],
    apiPrefixes: ["/api/integrations/meta", "/api/webhooks/meta"],
    jobTags: [],
  },
  {
    key: MODULE_KEYS.LINKEDIN_ASSIST,
    label: "LinkedIn assist",
    navLabel: "LinkedIn",
    availableOn: "Growth",
    pagePrefixes: [],
    apiPrefixes: ["/api/integrations/linkedin", "/api/linkedin"],
    jobTags: [],
  },
  {
    key: MODULE_KEYS.ANALYTICS_ADVANCED,
    label: "Analytics",
    navLabel: "Analytics",
    availableOn: "Growth",
    pagePrefixes: ["/analytics"],
    apiPrefixes: ["/api/analytics"],
    jobTags: [],
  },
  {
    key: MODULE_KEYS.WHITE_LABEL,
    label: "White-label",
    navLabel: "White-label",
    availableOn: "Agency",
    pagePrefixes: [],
    apiPrefixes: [],
    jobTags: [],
  },
  {
    key: MODULE_KEYS.API_ACCESS,
    label: "API access",
    navLabel: "API",
    availableOn: "Agency",
    pagePrefixes: [],
    apiPrefixes: ["/api/v1"],
    jobTags: [],
  },
];

export function getModuleDef(key: string): ModuleDef | undefined {
  return MODULE_CATALOG.find((m) => m.key === key);
}

/** Map dashboard pathname (under /dashboard) → module key */
export function moduleForDashboardPath(pathname: string): ModuleKey | null {
  const p = pathname.replace(/^\/dashboard/, "") || "";
  const normalized = p.split("?")[0] || "";
  // Exact home
  if (normalized === "" || normalized === "/") return MODULE_KEYS.DASHBOARD;

  let best: ModuleDef | null = null;
  let bestLen = -1;
  for (const m of MODULE_CATALOG) {
    for (const prefix of m.pagePrefixes) {
      if (!prefix) continue;
      if (
        normalized === prefix ||
        normalized.startsWith(prefix + "/")
      ) {
        if (prefix.length > bestLen) {
          best = m;
          bestLen = prefix.length;
        }
      }
    }
  }
  return best?.key ?? null;
}

/** Map API pathname → module key */
export function moduleForApiPath(pathname: string): ModuleKey | null {
  let best: ModuleDef | null = null;
  let bestLen = -1;
  for (const m of MODULE_CATALOG) {
    for (const prefix of m.apiPrefixes) {
      if (pathname === prefix || pathname.startsWith(prefix + "/")) {
        if (prefix.length > bestLen) {
          best = m;
          bestLen = prefix.length;
        }
      }
    }
  }
  return best?.key ?? null;
}

/** Paths always allowed while subscription is locked (NONE/EXPIRED). */
export const LIFECYCLE_OPEN_PATH_PREFIXES = [
  "/billing/choose-plan",
  "/billing",
  "/settings/account",
  "/settings?tab=account",
] as const;

export function isLifecycleOpenDashboardPath(pathname: string): boolean {
  const p = pathname.replace(/^\/dashboard/, "") || pathname;
  if (p.startsWith("/billing")) return true;
  if (p.startsWith("/settings")) {
    // Allow account/password; billing tab also open
    return true;
  }
  return false;
}

/** Limit/seat keys that are not modules (still on PlanVersionFeature). */
export const LIMIT_FEATURE_KEYS: FeatureKey[] = [
  FEATURE_KEYS.USERS,
  FEATURE_KEYS.OPPORTUNITIES,
  FEATURE_KEYS.AI_CALLS,
  FEATURE_KEYS.EMAILS,
  FEATURE_KEYS.EMAILS_DAILY,
  FEATURE_KEYS.SEQUENCES,
  FEATURE_KEYS.SOURCES,
  FEATURE_KEYS.ENRICHMENT,
  FEATURE_KEYS.AUDITS,
  FEATURE_KEYS.CRAWLS,
  FEATURE_KEYS.MEETINGS,
  FEATURE_KEYS.INBOX_ACCOUNTS,
  FEATURE_KEYS.OUTBOUND_MAILBOXES,
  FEATURE_KEYS.AUTOMATION,
  FEATURE_KEYS.ADVANCED_AI,
  FEATURE_KEYS.LEARNING,
  FEATURE_KEYS.CONNECTORS,
  FEATURE_KEYS.ICPS,
  FEATURE_KEYS.CAMPAIGNS,
];

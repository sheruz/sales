/** Maps marketing routes to on-brand SVG mockups under /public/marketing/illustrations. */

const ILLUSTRATION_BASE = "/marketing/illustrations";

export type PageVisualKey =
  | "web-dashboard"
  | "mobile-apps"
  | "erp-board"
  | "crm-pipeline"
  | "saas-tenancy"
  | "automation-flow"
  | "website-marketing"
  | "mvp-scope"
  | "ai-workspace"
  | "dispatch-board"
  | "property-portal"
  | "clinic-booking"
  | "audit-report"
  | "process-timeline"
  | "code-stack"
  | "construction-jobs"
  | "retail-inventory"
  | "security-panel"
  | "studio-team"
  | "chatbot-inbox"
  | "document-ocr";

const SERVICE_VISUALS: Record<string, PageVisualKey> = {
  "web-applications": "web-dashboard",
  "mobile-apps": "mobile-apps",
  "erp-development": "erp-board",
  "crm-development": "crm-pipeline",
  "saas-development": "saas-tenancy",
  "automation-integrations": "automation-flow",
  "website-development": "website-marketing",
  "mvp-development": "mvp-scope",
  "fixed-price-projects": "mvp-scope",
  "dedicated-developers": "code-stack",
  "product-retainer": "web-dashboard",
  "project-rescue": "code-stack",
  "technical-consulting": "process-timeline",
  discovery: "process-timeline",
  "legacy-modernization": "code-stack",
};

const AI_VISUALS: Record<string, PageVisualKey> = {
  "ai-integrations": "ai-workspace",
  "ai-agents": "ai-workspace",
  "document-processing": "document-ocr",
  chatbots: "chatbot-inbox",
  "sales-automation": "crm-pipeline",
};

const INDUSTRY_VISUALS: Record<string, PageVisualKey> = {
  "logistics-trucking": "dispatch-board",
  "real-estate": "property-portal",
  "healthcare-clinics": "clinic-booking",
  "construction-trades": "construction-jobs",
  "retail-inventory": "retail-inventory",
  "professional-services": "crm-pipeline",
  education: "website-marketing",
  "startups-saas": "saas-tenancy",
};

const TECH_VISUALS: Record<string, PageVisualKey> = {
  nextjs: "code-stack",
  react: "code-stack",
  nodejs: "code-stack",
  laravel: "code-stack",
  python: "code-stack",
  "react-native": "mobile-apps",
  flutter: "mobile-apps",
  postgresql: "code-stack",
  aws: "code-stack",
  openai: "ai-workspace",
  anthropic: "ai-workspace",
};

const SOLUTION_VISUALS: Record<string, PageVisualKey> = {
  mvp: "mvp-scope",
  "saas-platform": "saas-tenancy",
  "dedicated-team": "code-stack",
  discovery: "process-timeline",
};

const STATIC_VISUALS: Record<string, PageVisualKey> = {
  "/services": "web-dashboard",
  "/ai": "ai-workspace",
  "/industries": "dispatch-board",
  "/technologies": "code-stack",
  "/about": "studio-team",
  "/process": "process-timeline",
  "/pricing": "mvp-scope",
  "/security": "security-panel",
  "/careers": "studio-team",
  "/contact": "website-marketing",
  "/free-audit": "audit-report",
  "/faq": "website-marketing",
  "/for-agencies": "saas-tenancy",
  "/solutions": "web-dashboard",
  "/autopilot": "web-dashboard",
  "/work": "web-dashboard",
};

const ALT_BY_KEY: Record<PageVisualKey, string> = {
  "web-dashboard": "Operations console mockup",
  "mobile-apps": "Mobile app screens mockup",
  "erp-board": "ERP board mockup",
  "crm-pipeline": "CRM pipeline mockup",
  "saas-tenancy": "SaaS admin console mockup",
  "automation-flow": "Automation workflow mockup",
  "website-marketing": "Marketing website layout mockup",
  "mvp-scope": "MVP scope and milestones mockup",
  "ai-workspace": "AI workspace mockup",
  "dispatch-board": "Dispatch board mockup",
  "property-portal": "Property listings portal mockup",
  "clinic-booking": "Clinic booking calendar mockup",
  "audit-report": "Website audit report mockup",
  "process-timeline": "Delivery process timeline mockup",
  "code-stack": "Technology stack mockup",
  "construction-jobs": "Construction jobs board mockup",
  "retail-inventory": "Retail inventory dashboard mockup",
  "security-panel": "Security and access controls mockup",
  "studio-team": "Studio collaboration workspace mockup",
  "chatbot-inbox": "Support chatbot inbox mockup",
  "document-ocr": "Document processing workspace mockup",
};

export function illustrationSrc(key: PageVisualKey): string {
  return `${ILLUSTRATION_BASE}/${key}.svg`;
}

export function illustrationAlt(key: PageVisualKey, fallback?: string): string {
  return fallback ?? ALT_BY_KEY[key];
}

export function visualForService(slug: string): PageVisualKey {
  return SERVICE_VISUALS[slug] ?? "web-dashboard";
}

export function visualForAi(slug: string): PageVisualKey {
  return AI_VISUALS[slug] ?? "ai-workspace";
}

export function visualForIndustry(slug: string): PageVisualKey {
  return INDUSTRY_VISUALS[slug] ?? "web-dashboard";
}

export function visualForTechnology(slug: string): PageVisualKey {
  return TECH_VISUALS[slug] ?? "code-stack";
}

export function visualForSolution(slug: string): PageVisualKey {
  return SOLUTION_VISUALS[slug] ?? "web-dashboard";
}

export function visualForPath(path: string): PageVisualKey {
  return STATIC_VISUALS[path] ?? "website-marketing";
}

/** Second visual for body sections — never the same as the hero visual. */
export function bodyVisualFor(
  hero: PageVisualKey,
  preferred?: PageVisualKey
): PageVisualKey {
  if (preferred && preferred !== hero) return preferred;
  const pool: PageVisualKey[] = [
    "web-dashboard",
    "mvp-scope",
    "automation-flow",
    "process-timeline",
    "code-stack",
    "website-marketing",
    "crm-pipeline",
    "saas-tenancy",
    "audit-report",
    "ai-workspace",
  ];
  return pool.find((k) => k !== hero) ?? "website-marketing";
}

export function bodyVisualForService(slug: string): PageVisualKey {
  const hero = visualForService(slug);
  const preferred: Record<string, PageVisualKey> = {
    "web-applications": "automation-flow",
    "mobile-apps": "web-dashboard",
    "erp-development": "dispatch-board",
    "crm-development": "automation-flow",
    "saas-development": "web-dashboard",
    "automation-integrations": "crm-pipeline",
    "website-development": "audit-report",
    "mvp-development": "web-dashboard",
    "fixed-price-projects": "process-timeline",
    "dedicated-developers": "web-dashboard",
    "product-retainer": "process-timeline",
    "project-rescue": "mvp-scope",
    "technical-consulting": "code-stack",
    discovery: "mvp-scope",
    "legacy-modernization": "web-dashboard",
  };
  return bodyVisualFor(hero, preferred[slug]);
}

export function bodyVisualForAi(slug: string): PageVisualKey {
  const hero = visualForAi(slug);
  const preferred: Record<string, PageVisualKey> = {
    "ai-integrations": "automation-flow",
    "ai-agents": "crm-pipeline",
    "document-processing": "ai-workspace",
    chatbots: "website-marketing",
    "sales-automation": "ai-workspace",
  };
  return bodyVisualFor(hero, preferred[slug]);
}

export function bodyVisualForIndustry(slug: string): PageVisualKey {
  const hero = visualForIndustry(slug);
  const preferred: Record<string, PageVisualKey> = {
    "logistics-trucking": "erp-board",
    "real-estate": "crm-pipeline",
    "healthcare-clinics": "website-marketing",
    "construction-trades": "erp-board",
    "retail-inventory": "saas-tenancy",
    "professional-services": "web-dashboard",
    education: "saas-tenancy",
    "startups-saas": "mvp-scope",
  };
  return bodyVisualFor(hero, preferred[slug]);
}

export function bodyVisualForTechnology(slug: string): PageVisualKey {
  const hero = visualForTechnology(slug);
  return bodyVisualFor(
    hero,
    hero === "code-stack" ? "web-dashboard" : "code-stack"
  );
}

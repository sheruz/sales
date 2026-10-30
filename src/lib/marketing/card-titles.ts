/** Short human labels for cards, menus and footer — never long SEO titles. */

export const SERVICE_CARD_TITLES: Record<string, string> = {
  "web-applications": "Web applications",
  "mobile-apps": "Mobile apps",
  "erp-development": "ERP systems",
  "crm-development": "CRM systems",
  "saas-development": "SaaS platforms",
  "automation-integrations": "Automation & integrations",
  "website-development": "Websites",
  "mvp-development": "MVP development",
  "fixed-price-projects": "Fixed-price projects",
  "dedicated-developers": "Dedicated developers",
  "product-retainer": "Product retainer",
  "project-rescue": "Project rescue",
  "technical-consulting": "Technical consulting",
  discovery: "Discovery & scoping",
  "legacy-modernization": "Legacy modernization",
};

export function serviceCardTitle(slug: string, fallback?: string): string {
  return SERVICE_CARD_TITLES[slug] ?? fallback ?? slug;
}

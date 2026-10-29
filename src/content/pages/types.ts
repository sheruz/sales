export type FaqItem = { q: string; a: string };
export type IconBlock = { title: string; body: string; icon?: string };
export type RelatedLink = { href: string; label: string };

export type ServicePageContent = {
  slug: string;
  seoTitle: string; // max 60
  seoDescription: string; // max 155
  h1: string;
  subline: string; // 2 lines worth
  problems: IconBlock[]; // exactly 4
  deliverables: IconBlock[]; // exactly 6
  steps: Array<{ title: string; body: string }>; // 4-6
  timeline: string; // typical ranges, not promises
  techSlugs: string[]; // link to /technologies/[slug]
  whoFor: string[]; // 3
  whoNotFor: string[]; // 3
  relatedCaseStudySlug?: string; // only if verified — use "revenue-os" only where truly related (SaaS/AI/web), else omit
  relatedPages: RelatedLink[]; // exactly 3
  faq: FaqItem[]; // 5-6
  // long-form body paragraphs for word count (hero already separate)
  intro: string; // 2-3 short paragraphs joined with \n\n
};

export type AiPageContent = ServicePageContent & {
  whereHelps: string[];
  whereDoesnt: string[];
  dataPrivacy: string; // BYOK, your data stays yours
};

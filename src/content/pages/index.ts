export type {
  FaqItem,
  IconBlock,
  RelatedLink,
  ServicePageContent,
  AiPageContent,
} from "./types";
export { servicePages, getServicePage } from "./services";
export { aiPages, getAiPage } from "./ai";
export {
  technologyPages,
  getTechnologyPage,
  type TechPageContent,
} from "./technologies";
export {
  industryPages,
  getIndustryPage,
  type IndustryPageContent,
} from "./industries";
export {
  aboutPage,
  processPageDetailed,
  pricingPage,
  securityPageDetailed,
  careersPage,
  freeAuditPage,
  contactPageExtras,
  type AboutPageContent,
  type ProcessPageContent,
  type PricingPageContent,
  type SecurityPageContent,
  type CareersPageContent,
  type FreeAuditPageContent,
  type ContactPageExtras,
} from "./company";

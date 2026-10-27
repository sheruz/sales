/**
 * Delvix Studio marketing site — single source of truth.
 * Empty arrays → section hidden. Case studies / testimonials need verified: true.
 */

export const siteConfig = {
  name: "Delvix Studio",
  legalName: "Delvix Studio",
  tagline: "We build the systems behind growing businesses.",
  url: "https://delvixstudio.com",
  locale: "en_US",
  /** Wordmark for dark backgrounds (header / footer / dark hero chrome) */
  logoOnDark: "/delvix-logo-on-dark.svg",
  /** Wordmark for light backgrounds */
  logoOnLight: "/delvix-logo-on-light.svg",
  icon: "/delvix-icon-dark.svg",
  contact: {
    email: "hello@delvixstudio.com",
    phone: "+971581177638",
    phoneDisplay: "+971 58 117 7638",
    whatsapp: "https://wa.me/971581177638",
    bookingUrl: "https://cal.com/delvix/intro", // replace when ready
  },
  socials: [] as Array<{ label: string; href: string }>,
  /** Leave empty → stats strip hidden */
  stats: [] as Array<{ label: string; value: string }>,
  /** Leave empty / unverified → section hidden */
  team: [] as Array<{
    name: string;
    role: string;
    bio?: string;
    image?: string;
  }>,
  offers: [] as Array<{
    name: string;
    priceFrom?: number;
    currency?: string;
    days?: number;
    includes: string;
    href?: string;
  }>,
} as const;

export type ServiceSlug =
  | "web-apps"
  | "mobile-apps"
  | "erp-crm"
  | "ai-integrations"
  | "automation"
  | "project-rescue";

export type Service = {
  slug: ServiceSlug;
  name: string;
  short: string;
  headline: string;
  problem: string;
  whoFor: string[];
  outcomes: string[];
  whatWeBuild: string[];
  deliverables: string[];
  stack: string[];
  faq: Array<{ q: string; a: string }>;
  relatedSolutionSlugs?: string[];
  icon: "web" | "mobile" | "erp" | "ai" | "auto" | "rescue";
};

export const services: Service[] = [
  {
    slug: "web-apps",
    name: "Web apps",
    short: "Customer-facing and internal web products that your team can run.",
    headline: "Web apps your ops team can actually live in",
    problem:
      "Spreadsheets, shared inboxes and three SaaS tabs that do not talk to each other slow the business down. Staff invent workarounds; customers wait; nobody trusts the numbers.",
    whoFor: [
      "Operators who outgrew sheets and chat threads",
      "Teams shipping a client portal or multi-tenant SaaS",
      "Founders who need a real product, not a brochure site",
    ],
    outcomes: [
      "One place for the workflow that used to live in five tools",
      "Roles, audit trail and permissions that match how you work",
      "Code and credentials you can host or hand to your next engineer",
    ],
    whatWeBuild: [
      "Multi-tenant SaaS and client portals",
      "Admin consoles and ops dashboards",
      "API-backed apps with auth, roles and audit logs",
      "Billing, notifications and file workflows when the product needs them",
    ],
    deliverables: [
      "Written scope with milestones",
      "Design for core flows",
      "Production deploy + handover docs",
      "Weekly demos during build",
    ],
    stack: ["Next.js", "React", "Node.js", "PostgreSQL", "AWS"],
    icon: "web",
    relatedSolutionSlugs: ["mvp", "saas-platform"],
    faq: [
      {
        q: "Do we own the code?",
        a: "Yes. Source, infra docs and credentials transfer to you. No platform lock-in.",
      },
      {
        q: "Can you work with our designers?",
        a: "Yes. We implement from Figma or design in-house after a written scope.",
      },
      {
        q: "How long does a typical web app take?",
        a: "Depends on scope. After discovery you get a written timeline with milestones — not a vague range.",
      },
    ],
  },
  {
    slug: "mobile-apps",
    name: "Mobile apps",
    short: "iOS and Android apps that share a backend with your web product.",
    headline: "Mobile apps built for field work and customers on the go",
    problem:
      "Field teams and customers need a phone-first workflow, not a desktop site squeezed onto a screen. Offline gaps and push gaps kill adoption.",
    whoFor: [
      "Businesses with drivers, crews or visits on site",
      "Products that already have (or need) a shared API",
      "Teams replacing paper forms on phones",
    ],
    outcomes: [
      "One codebase path for iOS and Android when it fits",
      "Shared auth and data with your web app",
      "Store-ready builds with a clear release checklist",
    ],
    whatWeBuild: [
      "React Native or Flutter clients",
      "Push notifications and offline-tolerant flows",
      "Shared APIs with your web app",
      "Camera, location and document capture when the job needs it",
    ],
    deliverables: [
      "Written mobile scope and device matrix",
      "TestFlight / Play internal tracks",
      "API contract with the backend",
      "Handover for store listing assets you provide",
    ],
    stack: ["React Native", "Flutter", "Node.js", "PostgreSQL"],
    icon: "mobile",
    relatedSolutionSlugs: ["mvp"],
    faq: [
      {
        q: "Native or cross-platform?",
        a: "We default to cross-platform unless a store requirement or device API forces native.",
      },
      {
        q: "Do you publish to the stores?",
        a: "We prepare builds and guide submission. Your developer accounts own the listing.",
      },
    ],
  },
  {
    slug: "erp-crm",
    name: "Custom ERP & CRM",
    short: "Systems shaped around how you sell, stock and deliver — not the other way around.",
    headline: "ERP and CRM that follow your process",
    problem:
      "Off-the-shelf ERP/CRM forces your process into someone else's workflow and unused modules. Teams keep a shadow spreadsheet beside the ‘system of record’.",
    whoFor: [
      "Operators with inventory, jobs or pipeline that do not fit SaaS defaults",
      "Teams migrating off Excel as the real CRM",
      "Businesses that need reporting the vendor cannot configure",
    ],
    outcomes: [
      "Pipeline and ops in one system your staff will use",
      "Cleaner handoffs between sales, delivery and finance",
      "Exports and APIs so you are not trapped",
    ],
    whatWeBuild: [
      "Pipeline, inventory and job workflows",
      "Role-based access and reporting",
      "Integrations with the tools you already pay for",
      "Migration from sheets or legacy tools with a cutover plan",
    ],
    deliverables: [
      "Process map + written scope",
      "Data migration plan",
      "Admin training notes",
      "Go-live checklist",
    ],
    stack: ["Next.js", "Node.js", "PostgreSQL", "Python"],
    icon: "erp",
    relatedSolutionSlugs: ["discovery"],
    faq: [
      {
        q: "Can you migrate from spreadsheets?",
        a: "Yes. We map columns, clean data and cut over with a written plan.",
      },
      {
        q: "Will this replace Salesforce / Odoo?",
        a: "Sometimes. Often we replace the painful slice and keep what already works.",
      },
    ],
  },
  {
    slug: "ai-integrations",
    name: "AI integrations & agents",
    short: "Practical AI wired into your product — drafts, classification, agents with guardrails.",
    headline: "AI inside the workflow — with review and permissions",
    problem:
      "Chatbots bolted on the side do not change the workflow. Production AI needs tools, permissions, logging and a human review path when stakes are high.",
    whoFor: [
      "Product teams adding assistants to an existing app",
      "Ops teams drowning in email, PDFs or tickets",
      "Agencies that need drafting with brand and evidence, not generic fluff",
    ],
    outcomes: [
      "Drafts and classifications that land in your CRM or queue",
      "Agents that call your APIs under role limits",
      "Bring-your-own keys and encrypted storage",
    ],
    whatWeBuild: [
      "Assistants inside your app with tool access",
      "Document and email classification",
      "Human-in-the-loop review queues",
      "Reply and outreach agents with audit logs",
    ],
    deliverables: [
      "Threat and data-flow notes for the AI surface",
      "Prompt and tool inventory",
      "Review queue UX",
      "Cost and rate-limit guidance",
    ],
    stack: ["OpenAI", "Anthropic", "Node.js", "PostgreSQL"],
    icon: "ai",
    relatedSolutionSlugs: ["saas-platform"],
    faq: [
      {
        q: "Whose API keys?",
        a: "Yours. We integrate bring-your-own-key and keep credentials encrypted at rest.",
      },
      {
        q: "Will you train models on our data?",
        a: "Not through our application layer. Provider policies for your BYOK keys still apply.",
      },
    ],
  },
  {
    slug: "automation",
    name: "Automation & integrations",
    short: "Connect the stack you already use so work moves without copy-paste.",
    headline: "Integrations that survive real volume",
    problem:
      "Manual handoffs between CRM, email, sheets and ops tools create delays and errors. Fragile Zapier chains break silently.",
    whoFor: [
      "Teams with two or more systems that must stay in sync",
      "Ops leads tired of re-keying the same record",
      "Products that need webhooks and scheduled jobs with retries",
    ],
    outcomes: [
      "Fewer manual steps between tools you already pay for",
      "Visible failures and retries instead of silent drift",
      "Internal tools when a spreadsheet is no longer enough",
    ],
    whatWeBuild: [
      "API and webhook integrations",
      "Scheduled jobs and sync with retries",
      "Internal tools that glue systems together",
      "Idempotent imports and reconciliation reports",
    ],
    deliverables: [
      "Integration map",
      "Error and retry policy",
      "Runbooks for common failures",
      "Monitoring hooks you can keep",
    ],
    stack: ["Node.js", "Python", "PostgreSQL", "AWS"],
    icon: "auto",
    relatedSolutionSlugs: ["discovery"],
    faq: [
      {
        q: "Zapier or custom?",
        a: "Zapier for light glue. Custom when you need reliability, volume or complex rules.",
      },
      {
        q: "Can you work with our existing vendor APIs?",
        a: "Yes — if they expose a documented API or webhook. We write that into the scope.",
      },
    ],
  },
  {
    slug: "project-rescue",
    name: "Project rescue",
    short: "Stabilize a stuck build, then ship a clear path to production.",
    headline: "Unstick a build that slipped",
    problem:
      "The previous vendor left half-built code, unclear scope and a launch date that slipped. You need honesty before another invoice cycle.",
    whoFor: [
      "Founders mid-build with no confidence in delivery",
      "Teams inheriting code with no docs",
      "Buyers who need a second opinion before rewriting",
    ],
    outcomes: [
      "A written risk list and salvage vs rewrite recommendation",
      "A stabilization sprint with visible progress",
      "A path to launch you can defend to stakeholders",
    ],
    whatWeBuild: [
      "Code and architecture review",
      "Stabilization sprint with a written plan",
      "Takeover of delivery through launch",
      "Handover package for your next team if you prefer",
    ],
    deliverables: [
      "Audit memo (risks, debt, go/no-go)",
      "Stabilization backlog",
      "Revised launch plan",
      "Optional ongoing retainer",
    ],
    stack: ["Depends on your stack"],
    icon: "rescue",
    relatedSolutionSlugs: ["discovery", "dedicated-team"],
    faq: [
      {
        q: "Do you rewrite everything?",
        a: "Only when the foundation cannot ship. Prefer salvage with a clear risk list.",
      },
      {
        q: "How fast can you start a rescue?",
        a: "Discovery call first, then a fixed-price review week when you approve the scope.",
      },
    ],
  },
];

export type IndustrySlug =
  | "logistics"
  | "real-estate"
  | "clinics"
  | "construction"
  | "retail"
  | "professional-services";

export type Industry = {
  slug: IndustrySlug;
  name: string;
  short: string;
  headline: string;
  problems: string[];
  whatWeBuild: string[];
  modules: string[];
  outcomes: string[];
  faq: Array<{ q: string; a: string }>;
  relatedServiceSlugs?: ServiceSlug[];
  relatedCaseStudySlug?: string;
};

export const industries: Industry[] = [
  {
    slug: "logistics",
    name: "Logistics & trucking",
    short: "Dispatch, tracking and paperwork that keep trucks moving.",
    headline: "Software for fleets that still run on WhatsApp and sheets",
    problems: [
      "Loads tracked in WhatsApp and sheets",
      "No single view of drivers, freight and invoices",
      "Customers asking for status you cannot see",
      "POD and paperwork arriving late or incomplete",
    ],
    whatWeBuild: [
      "Dispatch and status portals",
      "Document and POD workflows",
      "Integrations with telematics or accounting",
      "Driver-facing mobile capture when needed",
    ],
    modules: [
      "Load board / dispatch board",
      "Driver and asset roster",
      "Document vault (BOL, POD, invoices)",
      "Customer status page",
      "Basic billing hooks",
    ],
    outcomes: [
      "Dispatchers see open loads without hunting chats",
      "Customers get status without calling the office",
      "Paperwork lands in one place before invoicing",
    ],
    relatedServiceSlugs: ["web-apps", "mobile-apps", "erp-crm", "automation"],
    faq: [
      {
        q: "Do you integrate ELD / GPS?",
        a: "When the vendor has an API. We list the connector in the written scope.",
      },
      {
        q: "Can drivers use it on phones?",
        a: "Yes — mobile web or app, depending on offline and store needs.",
      },
    ],
  },
  {
    slug: "real-estate",
    name: "Real estate & property management",
    short: "Owner, tenant and maintenance workflows in one place.",
    headline: "Property ops without the email black hole",
    problems: [
      "Leases and renewals living in email",
      "Maintenance tickets with no owner",
      "Owners without a clear portfolio view",
      "Showing and listing data scattered across tools",
    ],
    whatWeBuild: [
      "Owner and tenant portals",
      "Maintenance and inspection flows",
      "Reporting and document vaults",
      "Listing and lead intake when sales is part of the job",
    ],
    modules: [
      "Property and unit registry",
      "Lease calendar and renewals",
      "Maintenance tickets",
      "Owner reporting",
      "Document vault",
    ],
    outcomes: [
      "Tickets have an owner and a status",
      "Owners see portfolio facts without chasing PMs",
      "Renewals stop falling through cracks",
    ],
    relatedServiceSlugs: ["web-apps", "erp-crm", "automation"],
    faq: [
      {
        q: "Multi-property portfolios?",
        a: "Yes. Role-based views for owners, PMs and vendors.",
      },
    ],
  },
  {
    slug: "clinics",
    name: "Clinics & healthcare",
    short: "Scheduling, intake and follow-up without extra admin load.",
    headline: "Clinic ops software that respects staff time",
    problems: [
      "Double-booked calendars",
      "Paper intake and lost follow-ups",
      "Staff bouncing between tools",
      "No clear view of no-shows and recalls",
    ],
    whatWeBuild: [
      "Booking and reminder systems",
      "Secure patient or client portals",
      "Internal ops dashboards",
      "Intake forms that land in the right queue",
    ],
    modules: [
      "Scheduling and reminders",
      "Intake / questionnaires",
      "Staff roster views",
      "Follow-up queues",
      "Basic reporting",
    ],
    outcomes: [
      "Fewer no-shows with reminders you control",
      "Intake ready before the visit",
      "Staff stop retyping the same details",
    ],
    relatedServiceSlugs: ["web-apps", "mobile-apps", "automation"],
    faq: [
      {
        q: "Are you a medical device / EHR vendor?",
        a: "No. We build operational systems around scheduling, intake and portals. Clinical systems stay with regulated vendors when required.",
      },
    ],
  },
  {
    slug: "construction",
    name: "Construction & trades",
    short: "Jobs, quotes and site updates that match how crews actually work.",
    headline: "Job systems for trades that live on site",
    problems: [
      "Quotes rewritten in Word every time",
      "Site photos scattered across phones",
      "No live view of open jobs",
      "Change orders lost between email and WhatsApp",
    ],
    whatWeBuild: [
      "Job and quote systems",
      "Field capture on mobile",
      "Client status pages",
      "Change-order and document trails",
    ],
    modules: [
      "Quote builder",
      "Job board",
      "Photo / note capture",
      "Client updates",
      "Invoice handoff",
    ],
    outcomes: [
      "Quotes reuse your real line items",
      "Office sees site progress without chasing crews",
      "Clients get status without calling the boss",
    ],
    relatedServiceSlugs: ["web-apps", "mobile-apps", "erp-crm"],
    faq: [
      {
        q: "Offline on site?",
        a: "We design for weak signal — queue sync when back online when the scope calls for it.",
      },
    ],
  },
  {
    slug: "retail",
    name: "Retail & inventory",
    short: "Stock, orders and channels without nightly spreadsheet merges.",
    headline: "Inventory and orders without the nightly merge",
    problems: [
      "Inventory out of sync across channels",
      "Manual order routing",
      "No clear low-stock signal",
      "Returns and exchanges tracked in chat",
    ],
    whatWeBuild: [
      "Inventory and order hubs",
      "Channel sync with retries",
      "Ops dashboards",
      "Low-stock and reorder alerts",
    ],
    modules: [
      "SKU and warehouse views",
      "Order inbox",
      "Channel connectors",
      "Stock alerts",
      "Basic fulfillment status",
    ],
    outcomes: [
      "One stock number staff can trust",
      "Orders route without retyping",
      "Alerts before you sell air",
    ],
    relatedServiceSlugs: ["web-apps", "automation", "erp-crm"],
    faq: [
      {
        q: "Shopify / Amazon?",
        a: "When those platforms expose APIs we can sync — listed in scope with rate limits and failure handling.",
      },
    ],
  },
  {
    slug: "professional-services",
    name: "Professional services",
    short: "Pipeline, delivery and retainers for firms that sell expertise.",
    headline: "Pipeline and delivery for firms that sell expertise",
    problems: [
      "Leads dying without follow-up",
      "Projects tracked in email threads",
      "No shared view of capacity",
      "Retainers without clear utilization",
    ],
    whatWeBuild: [
      "CRM and delivery portals",
      "Proposal and billing hooks",
      "Resource and utilization views",
      "Client status without status-meeting theater",
    ],
    modules: [
      "Lead and pipeline board",
      "Project workspace",
      "Time / capacity snapshot",
      "Proposal templates",
      "Client portal",
    ],
    outcomes: [
      "Follow-ups happen because the system nudges them",
      "Partners see capacity before promising dates",
      "Clients see progress without chasing PMs",
    ],
    relatedServiceSlugs: ["web-apps", "erp-crm", "ai-integrations"],
    faq: [
      {
        q: "Replace our PM tool?",
        a: "Only if it is the pain. Often we connect CRM + delivery and leave specialized PM tools alone.",
      },
    ],
  },
];

export type CaseStudy = {
  slug: string;
  title: string;
  clientType: string;
  problem: string;
  whatWeBuilt: string[];
  /** Real results only — empty hides the results block */
  results: string[];
  stack: string[];
  status: string;
  featured: boolean;
  verified: boolean;
  screenshots: Array<{ label: string; src: string; alt: string }>;
  platformFeatures?: string[];
  security?: string[];
};

export const caseStudies: CaseStudy[] = [
  {
    slug: "revenue-os",
    title: "Delvix Revenue OS",
    clientType: "B2B SaaS platform · AI + automation",
    problem:
      "Agencies and freelancers waste hours finding clients: manual prospect research, generic cold emails and no follow-up system.",
    whatWeBuilt: [
      "Finds businesses through Google Places and crawls their websites",
      "Enriches decision makers with a provider waterfall",
      "Runs a deep website audit: headless browser, desktop + mobile screenshots, evidence-based findings",
      "Writes personalized outreach with AI, answers replies with an AI agent, and tracks the pipeline",
    ],
    platformFeatures: [
      "Packages with versioned plans and a credit system",
      "Paddle billing",
      "Super Admin console",
      "Per-tenant integrations (bring your own keys)",
      "2FA and audit logs",
    ],
    security: [
      "SSRF protection",
      "Tenant isolation",
      "Encrypted credentials",
    ],
    results: [],
    stack: [
      "Next.js",
      "TypeScript",
      "PostgreSQL",
      "Prisma",
      "Playwright",
      "Paddle",
      "OpenAI/Anthropic",
      "AWS",
    ],
    status:
      "In production, used daily for our own client acquisition. Early access for agencies.",
    featured: true,
    verified: true,
    screenshots: [
      {
        label: "Dashboard",
        src: "/marketing/screenshots/revenue-os-dashboard.svg",
        alt: "Revenue OS dashboard placeholder",
      },
      {
        label: "Deep audit findings",
        src: "/marketing/screenshots/revenue-os-audit.svg",
        alt: "Deep audit findings placeholder",
      },
      {
        label: "Super Admin packages",
        src: "/marketing/screenshots/revenue-os-packages.svg",
        alt: "Super Admin packages placeholder",
      },
      {
        label: "Pipeline",
        src: "/marketing/screenshots/revenue-os-pipeline.svg",
        alt: "Pipeline placeholder",
      },
    ],
  },
];

export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  company?: string;
  verified: boolean;
};

/** Hidden until verified entries exist */
export const testimonials: Testimonial[] = [];

export const engagementModels = [
  {
    name: "Fixed-price project",
    fits: "Clear deliverable and a real deadline.",
    includes: [
      "Written scope before build",
      "Milestone demos",
      "Source handover on launch",
    ],
  },
  {
    name: "Monthly retainer",
    fits: "Ongoing product work after launch.",
    includes: [
      "Agreed capacity each month",
      "Backlog you prioritize",
      "Same team week to week",
    ],
  },
  {
    name: "Dedicated developer",
    fits: "You need a senior engineer inside your cadence.",
    includes: [
      "Embedded in your tools and standups",
      "Clear ownership of a workstream",
      "Flexible month-to-month",
    ],
  },
] as const;

export const processSteps = [
  {
    n: "01",
    title: "Discovery call",
    body: "We learn what you run today, what hurts and what “done” looks like.",
  },
  {
    n: "02",
    title: "Written scope in 3 days",
    body: "Fixed scope, milestones and assumptions — before any build starts.",
  },
  {
    n: "03",
    title: "Design",
    body: "Flows and UI that match how your team actually works.",
  },
  {
    n: "04",
    title: "Build with weekly demos",
    body: "Working software every week. You see progress, not status decks.",
  },
  {
    n: "05",
    title: "Launch",
    body: "Cutover plan, training notes and credentials in your hands.",
  },
  {
    n: "06",
    title: "Support & grow",
    body: "Retainer or project follow-ons when you are ready to extend.",
  },
] as const;

export const whyDelvixRows = [
  { label: "Fixed written scope", delvix: "Yes, before build", typical: "Often verbal or shifting" },
  { label: "Weekly demos", delvix: "Every week", typical: "Status email or late reveal" },
  { label: "Code ownership", delvix: "Yours from day one", typical: "Hosted on their stack" },
  { label: "Developer access", delvix: "Direct", typical: "Account manager only" },
  { label: "Scope turnaround", delvix: "Written in 3 days", typical: "Weeks of discovery" },
  { label: "Timezone overlap", delvix: "US / UK / EU / Gulf", typical: "Overnight handoffs" },
] as const;

export const techStack = {
  Frontend: ["Next.js", "React"],
  Backend: ["Node.js", "PHP/Laravel", "Python"],
  Mobile: ["React Native", "Flutter"],
  "Data / Cloud": ["PostgreSQL", "AWS"],
  AI: ["OpenAI", "Anthropic"],
} as const;

export const faq: Array<{ q: string; a: string }> = [
  {
    q: "How fast can you start?",
    a: "After a discovery call we send a written scope within three days. Build starts when you approve that scope.",
  },
  {
    q: "How does pricing work?",
    a: "Fixed-price for defined projects. Monthly retainers or a dedicated developer for ongoing work. Prices appear on /pricing when published.",
  },
  {
    q: "What are your working hours and timezones?",
    a: "We keep overlap with US, UK, EU and Gulf hours so reviews happen in real time, not only overnight.",
  },
  {
    q: "Who owns the code?",
    a: "You do. Source, documentation and credentials transfer at handover. We do not lock you into a proprietary host.",
  },
  {
    q: "Do you sign NDAs?",
    a: "Yes. We sign a mutual NDA before sensitive materials are shared.",
  },
  {
    q: "How do we communicate during the build?",
    a: "Shared channel plus weekly demos of working software. Decisions are written down.",
  },
  {
    q: "What support do you offer after launch?",
    a: "Stabilization window on fixed projects, then optional retainer for changes and monitoring.",
  },
  {
    q: "How do we pay?",
    a: "Invoice by milestone or monthly. Card and bank options are confirmed in the proposal.",
  },
];

export const valueTags = [
  "Fixed scope",
  "Weekly demos",
  "You own the code",
] as const;

export const auditProblemOptions = [
  { value: "spreadsheets", label: "Spreadsheets everywhere" },
  { value: "manual_work", label: "Too much manual work" },
  { value: "outdated_website", label: "Outdated website" },
  { value: "need_an_app", label: "Need an app" },
  { value: "other", label: "Other" },
] as const;

export function verifiedCaseStudies() {
  return caseStudies.filter((c) => c.verified);
}

export function featuredCaseStudy() {
  return verifiedCaseStudies().find((c) => c.featured) ?? null;
}

export function getService(slug: string) {
  return services.find((s) => s.slug === slug) ?? null;
}

export function getIndustry(slug: string) {
  return industries.find((i) => i.slug === slug) ?? null;
}

export function getCaseStudy(slug: string) {
  return verifiedCaseStudies().find((c) => c.slug === slug) ?? null;
}

/** About page — founderStory empty → section hidden; team uses siteConfig.team */
export const aboutContent = {
  headline: "A software house that ships systems you can run",
  intro:
    "Delvix Studio designs and builds custom software for operational businesses. We write the scope first, demo weekly and hand over code you own.",
  founderStory: "",
  howWeDiffer: [
    "Written scope in three days — before build starts",
    "Weekly demos of working software, not slide decks",
    "Direct access to the people writing the code",
    "You own source, docs and credentials at handover",
  ],
};

export const values = [
  {
    title: "Scope before build",
    body: "No open-ended retainers disguised as discovery. You approve a written plan.",
  },
  {
    title: "Show working software",
    body: "Weekly demos beat status decks. Decisions stick because you saw the product.",
  },
  {
    title: "You own the outcome",
    body: "Source, docs and credentials transfer. We are not a black-box host.",
  },
  {
    title: "Say the hard thing early",
    body: "If a deadline or stack is risky, we write it down before you pay for surprise rework.",
  },
] as const;

export type SolutionSlug =
  | "mvp"
  | "saas-platform"
  | "dedicated-team"
  | "discovery";

export type Solution = {
  slug: SolutionSlug;
  name: string;
  short: string;
  headline: string;
  problem: string;
  includes: string[];
  outcomes: string[];
  relatedServiceSlugs: ServiceSlug[];
  faq: Array<{ q: string; a: string }>;
};

export const solutions: Solution[] = [
  {
    slug: "mvp",
    name: "MVP development",
    short: "A focused first release that proves the workflow with real users.",
    headline: "Ship a credible MVP without boiling the ocean",
    problem:
      "Teams either overbuild for months or ship a thin demo that cannot survive real use. You need a cut that is small and honest.",
    includes: [
      "Discovery and written MVP scope",
      "Core user flows only — explicit non-goals",
      "Production deploy you can put in front of users",
      "Backlog for version two, prioritized with you",
    ],
    outcomes: [
      "Something real to learn from — not a pitch deck",
      "Clear list of what was deferred and why",
      "Code you can keep extending",
    ],
    relatedServiceSlugs: ["web-apps", "mobile-apps", "ai-integrations"],
    faq: [
      {
        q: "How small is an MVP?",
        a: "Small enough to demo weekly and launch on a date you approve in the scope. We cut features in writing, not by surprise.",
      },
    ],
  },
  {
    slug: "saas-platform",
    name: "SaaS & multi-tenant platforms",
    short: "Tenancy, billing, roles and admin — the unglamorous parts that make a product sellable.",
    headline: "Multi-tenant SaaS with the hard parts included",
    problem:
      "A beautiful UI without tenancy, billing, audit logs and admin tools is not a product. Agencies and founders need the platform layer done right.",
    includes: [
      "Tenant isolation and role models",
      "Plans, credits or seats — wired to a billing provider",
      "Super-admin / ops console",
      "BYOK integrations and encrypted secrets when required",
    ],
    outcomes: [
      "You can onboard a second customer without forking the codebase",
      "Billing and entitlements match what you sell",
      "Ops can support tenants without SSH folklore",
    ],
    relatedServiceSlugs: ["web-apps", "ai-integrations", "automation"],
    faq: [
      {
        q: "Have you built this before?",
        a: "Yes — including Delvix Revenue OS, our own multi-tenant acquisition platform. See /work/revenue-os.",
      },
    ],
  },
  {
    slug: "dedicated-team",
    name: "Dedicated developer / team",
    short: "A senior engineer (or small pod) inside your cadence — not a black box agency.",
    headline: "Embedded capacity you can direct weekly",
    problem:
      "Hiring is slow; freelancers vanish; big agencies bury you in account managers. You need consistent output and direct access.",
    includes: [
      "Named engineer(s) on your tools and standups",
      "Agreed capacity each month",
      "Backlog you prioritize",
      "Flexible month-to-month after the first period",
    ],
    outcomes: [
      "Velocity without a full-time hire risk",
      "Knowledge stays in your repos and docs",
      "Easy to scale down when the rush ends",
    ],
    relatedServiceSlugs: ["web-apps", "mobile-apps", "project-rescue"],
    faq: [
      {
        q: "Is this staff augmentation?",
        a: "Close — with written expectations, demos and ownership of delivery quality, not just hours logged.",
      },
    ],
  },
  {
    slug: "discovery",
    name: "Project discovery",
    short: "A fixed, short engagement that produces a build-ready written scope.",
    headline: "Know what you are buying before you buy the build",
    problem:
      "Jumping straight into development without shared assumptions burns budget. Discovery turns fuzzy goals into a scope you can approve or walk away from.",
    includes: [
      "Stakeholder interviews and process mapping",
      "Risk and dependency list",
      "Written scope, milestones and assumptions",
      "Ballpark or fixed-price build option",
    ],
    outcomes: [
      "A document you can send to another vendor if you want a second bid",
      "Fewer surprise change orders later",
      "Clear go / no-go",
    ],
    relatedServiceSlugs: ["project-rescue", "erp-crm", "web-apps"],
    faq: [
      {
        q: "Is discovery free?",
        a: "The intro call is free. A full discovery with a written scope is a short fixed engagement — priced up front.",
      },
    ],
  },
];

export type Technology = {
  slug: string;
  name: string;
  group: keyof typeof techStack | "Other";
  short: string;
  whenWeUseIt: string[];
  relatedServiceSlugs: ServiceSlug[];
};

export const technologies: Technology[] = [
  {
    slug: "nextjs",
    name: "Next.js",
    group: "Frontend",
    short: "App Router web products with server rendering and API routes when they fit.",
    whenWeUseIt: [
      "SaaS dashboards and marketing + app monorepos",
      "SEO-sensitive public pages next to authenticated apps",
      "When React and Node in one deploy path reduce ops load",
    ],
    relatedServiceSlugs: ["web-apps", "erp-crm", "ai-integrations"],
  },
  {
    slug: "react",
    name: "React",
    group: "Frontend",
    short: "Component UIs for complex ops screens and design systems.",
    whenWeUseIt: [
      "Dense admin and dispatch boards",
      "Shared UI between web and React Native where it helps",
    ],
    relatedServiceSlugs: ["web-apps", "mobile-apps"],
  },
  {
    slug: "nodejs",
    name: "Node.js",
    group: "Backend",
    short: "APIs, workers and realtime-friendly services in TypeScript.",
    whenWeUseIt: [
      "Primary API for web and mobile clients",
      "Queue workers and webhook receivers",
    ],
    relatedServiceSlugs: ["web-apps", "automation", "ai-integrations"],
  },
  {
    slug: "postgresql",
    name: "PostgreSQL",
    group: "Data / Cloud",
    short: "Relational source of truth with migrations you can review.",
    whenWeUseIt: [
      "Multi-tenant data with row-level discipline",
      "Reporting that must stay consistent",
    ],
    relatedServiceSlugs: ["web-apps", "erp-crm"],
  },
  {
    slug: "react-native",
    name: "React Native",
    group: "Mobile",
    short: "Cross-platform mobile when one team owns iOS and Android.",
    whenWeUseIt: [
      "Field apps with shared business logic",
      "Products that already use React on the web",
    ],
    relatedServiceSlugs: ["mobile-apps"],
  },
  {
    slug: "flutter",
    name: "Flutter",
    group: "Mobile",
    short: "Cross-platform mobile when Flutter fits the team or UI needs.",
    whenWeUseIt: [
      "Polished custom UI across phones",
      "When the client already standardized on Flutter",
    ],
    relatedServiceSlugs: ["mobile-apps"],
  },
  {
    slug: "python",
    name: "Python",
    group: "Backend",
    short: "Data jobs, ML glue and services that prefer the Python ecosystem.",
    whenWeUseIt: [
      "ETL and enrichment pipelines",
      "AI tooling alongside a Node product API",
    ],
    relatedServiceSlugs: ["automation", "ai-integrations"],
  },
  {
    slug: "aws",
    name: "AWS",
    group: "Data / Cloud",
    short: "Hosting, object storage, queues and secrets for production systems.",
    whenWeUseIt: [
      "Production deploys with clear ownership",
      "File storage and background workers",
    ],
    relatedServiceSlugs: ["web-apps", "automation"],
  },
  {
    slug: "openai",
    name: "OpenAI",
    group: "AI",
    short: "LLM features with your keys, logging and human review where needed.",
    whenWeUseIt: [
      "Drafting, classification and tool-calling agents",
      "Products that need a mature API surface",
    ],
    relatedServiceSlugs: ["ai-integrations"],
  },
  {
    slug: "anthropic",
    name: "Anthropic",
    group: "AI",
    short: "Claude-powered workflows with the same BYOK and review discipline.",
    whenWeUseIt: [
      "Long-context drafting and analysis",
      "Teams that standardize on Anthropic",
    ],
    relatedServiceSlugs: ["ai-integrations"],
  },
];

export const securityPage = {
  headline: "How we treat security on client builds",
  intro:
    "We do not paste fake certifications on the marketing site. Below is what we actually practice on engagements — written into scope when it matters.",
  practices: [
    {
      title: "Tenant and data isolation",
      body: "Multi-tenant products get explicit org boundaries in the data model and queries — not shared tables with crossed fingers.",
    },
    {
      title: "Secrets and BYOK",
      body: "API keys and OAuth credentials are encrypted at rest when we store them. Prefer your keys in your cloud account.",
    },
    {
      title: "Auth that matches the product",
      body: "Roles, sessions and optional 2FA when the threat model needs them. Admin actions can be audit-logged.",
    },
    {
      title: "SSRF and untrusted input",
      body: "Anything that fetches customer-supplied URLs (crawlers, audits, webhooks) gets allowlists, timeouts and size limits.",
    },
    {
      title: "Handover without mystery",
      body: "You receive repos, env templates and access maps. We do not keep a silent copy of production keys after exit.",
    },
  ],
  faq: [
    {
      q: "Are you SOC 2 certified?",
      a: "We do not claim certifications we have not earned. If your procurement needs a specific report, we discuss it honestly in discovery.",
    },
    {
      q: "Where is data hosted?",
      a: "Wherever the written scope says — often your AWS account or a region you choose.",
    },
  ],
};

export const processPage = {
  headline: "How engagements run at Delvix",
  intro:
    "Same cadence whether the job is a portal, a mobile app or a rescue. Scope in writing. Software on a weekly rhythm.",
  principles: [
    {
      title: "Assumptions are written",
      body: "If we guessed, it is in the scope. Change requests update the document — not a Slack shrug.",
    },
    {
      title: "Demos beat status",
      body: "You click the build every week. Blockers show up while there is still time to steer.",
    },
    {
      title: "Handover is a milestone",
      body: "Launch includes credentials, runbooks and a clear owner on your side.",
    },
  ],
};

export function getSolution(slug: string) {
  return solutions.find((s) => s.slug === slug) ?? null;
}

export function getTechnology(slug: string) {
  return technologies.find((t) => t.slug === slug) ?? null;
}

export type NavChild = {
  href: string;
  label: string;
  description?: string;
};

export type NavItem = {
  href: string;
  label: string;
  /** When set, desktop shows a dropdown of every inner page */
  children?: NavChild[];
};

/** Full marketing nav — every inner page is listed under its parent (Software Pro–style). */
export function getMainNav(): NavItem[] {
  return [
    {
      href: "/services",
      label: "Services",
      children: [
        { href: "/services", label: "All services", description: "Overview of what we build" },
        ...services.map((s) => ({
          href: `/services/${s.slug}`,
          label: s.name,
          description: s.short,
        })),
      ],
    },
    {
      href: "/solutions",
      label: "Solutions",
      children: [
        { href: "/solutions", label: "All solutions", description: "How engagements are shaped" },
        ...solutions.map((s) => ({
          href: `/solutions/${s.slug}`,
          label: s.name,
          description: s.short,
        })),
        {
          href: "/for-agencies",
          label: "For agencies",
          description: "Studio builds + Autopilot for agencies",
        },
      ],
    },
    {
      href: "/industries",
      label: "Industries",
      children: [
        { href: "/industries", label: "All industries", description: "Operational businesses we serve" },
        ...industries.map((i) => ({
          href: `/industries/${i.slug}`,
          label: i.name,
          description: i.short,
        })),
      ],
    },
    {
      href: "/technologies",
      label: "Technologies",
      children: [
        { href: "/technologies", label: "All technologies", description: "Stacks we ship with" },
        ...technologies.map((t) => ({
          href: `/technologies/${t.slug}`,
          label: t.name,
          description: t.short,
        })),
      ],
    },
    {
      href: "/work",
      label: "Work",
      children: [
        { href: "/work", label: "Case studies", description: "Verified engagements only" },
        { href: "/work/revenue-os", label: "Delvix Revenue OS", description: "Our multi-tenant acquisition platform" },
      ],
    },
    {
      href: "/about",
      label: "Company",
      children: [
        { href: "/about", label: "About", description: "How Delvix works" },
        { href: "/process", label: "Process", description: "Discovery to launch" },
        { href: "/pricing", label: "Pricing", description: "Engagement models" },
        { href: "/faq", label: "FAQ", description: "Common questions" },
        { href: "/security", label: "Security", description: "How we handle risk" },
        { href: "/contact", label: "Contact", description: "Book a call or send a brief" },
      ],
    },
    { href: "/autopilot", label: "Autopilot" },
  ];
}

export const forAgenciesPage = {
  headline: "Built for agencies that sell delivery",
  intro:
    "Use Delvix Studio when you need custom software for a client — or Delvix Autopilot when you need a system to find and qualify your own clients.",
  studio: [
    "White-label or co-branded delivery with a written scope",
    "Weekly demos your client can attend",
    "Code ownership that matches your contract with them",
  ],
  autopilot: [
    "Prospecting, deep audit, outreach and pipeline in one product",
    "Early access for agencies — separate from studio retainers",
    "See how we built it: Revenue OS case study",
  ],
};

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
  problem: string;
  whatWeBuild: string[];
  stack: string[];
  faq: Array<{ q: string; a: string }>;
  icon: "web" | "mobile" | "erp" | "ai" | "auto" | "rescue";
};

export const services: Service[] = [
  {
    slug: "web-apps",
    name: "Web apps",
    short: "Customer-facing and internal web products that your team can run.",
    problem:
      "Spreadsheets, shared inboxes and three SaaS tabs that do not talk to each other slow the business down.",
    whatWeBuild: [
      "Multi-tenant SaaS and client portals",
      "Admin consoles and ops dashboards",
      "API-backed apps with auth, roles and audit logs",
    ],
    stack: ["Next.js", "React", "Node.js", "PostgreSQL"],
    icon: "web",
    faq: [
      {
        q: "Do we own the code?",
        a: "Yes. Source, infra docs and credentials transfer to you. No platform lock-in.",
      },
      {
        q: "Can you work with our designers?",
        a: "Yes. We implement from Figma or design in-house after a written scope.",
      },
    ],
  },
  {
    slug: "mobile-apps",
    name: "Mobile apps",
    short: "iOS and Android apps that share a backend with your web product.",
    problem:
      "Field teams and customers need a phone-first workflow, not a desktop site squeezed onto a screen.",
    whatWeBuild: [
      "React Native or Flutter clients",
      "Push notifications and offline-tolerant flows",
      "Shared APIs with your web app",
    ],
    stack: ["React Native", "Flutter", "Node.js", "PostgreSQL"],
    icon: "mobile",
    faq: [
      {
        q: "Native or cross-platform?",
        a: "We default to cross-platform unless a store requirement or device API forces native.",
      },
    ],
  },
  {
    slug: "erp-crm",
    name: "Custom ERP & CRM",
    short: "Systems shaped around how you sell, stock and deliver — not the other way around.",
    problem:
      "Off-the-shelf ERP/CRM forces your process into someone else's workflow and unused modules.",
    whatWeBuild: [
      "Pipeline, inventory and job workflows",
      "Role-based access and reporting",
      "Integrations with the tools you already pay for",
    ],
    stack: ["Next.js", "Node.js", "PostgreSQL", "Python"],
    icon: "erp",
    faq: [
      {
        q: "Can you migrate from spreadsheets?",
        a: "Yes. We map columns, clean data and cut over with a written plan.",
      },
    ],
  },
  {
    slug: "ai-integrations",
    name: "AI integrations & agents",
    short: "Practical AI wired into your product — drafts, classification, agents with guardrails.",
    problem:
      "Chatbots bolted on the side do not change the workflow. Production AI needs tools, permissions and review.",
    whatWeBuild: [
      "Assistants inside your app with tool access",
      "Document and email classification",
      "Human-in-the-loop review queues",
    ],
    stack: ["OpenAI", "Anthropic", "Node.js", "PostgreSQL"],
    icon: "ai",
    faq: [
      {
        q: "Whose API keys?",
        a: "Yours. We integrate bring-your-own-key and keep credentials encrypted at rest.",
      },
    ],
  },
  {
    slug: "automation",
    name: "Automation & integrations",
    short: "Connect the stack you already use so work moves without copy-paste.",
    problem:
      "Manual handoffs between CRM, email, sheets and ops tools create delays and errors.",
    whatWeBuild: [
      "API and webhook integrations",
      "Scheduled jobs and sync with retries",
      "Internal tools that glue systems together",
    ],
    stack: ["Node.js", "Python", "PostgreSQL", "AWS"],
    icon: "auto",
    faq: [
      {
        q: "Zapier or custom?",
        a: "Zapier for light glue. Custom when you need reliability, volume or complex rules.",
      },
    ],
  },
  {
    slug: "project-rescue",
    name: "Project rescue",
    short: "Stabilize a stuck build, then ship a clear path to production.",
    problem:
      "The previous vendor left half-built code, unclear scope and a launch date that slipped.",
    whatWeBuild: [
      "Code and architecture review",
      "Stabilization sprint with a written plan",
      "Takeover of delivery through launch",
    ],
    stack: ["Depends on your stack"],
    icon: "rescue",
    faq: [
      {
        q: "Do you rewrite everything?",
        a: "Only when the foundation cannot ship. Prefer salvage with a clear risk list.",
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
  problems: string[];
  whatWeBuild: string[];
  relatedCaseStudySlug?: string;
};

export const industries: Industry[] = [
  {
    slug: "logistics",
    name: "Logistics & trucking",
    short: "Dispatch, tracking and paperwork that keep trucks moving.",
    problems: [
      "Loads tracked in WhatsApp and sheets",
      "No single view of drivers, freight and invoices",
      "Customers asking for status you cannot see",
    ],
    whatWeBuild: [
      "Dispatch and status portals",
      "Document and POD workflows",
      "Integrations with telematics or accounting",
    ],
  },
  {
    slug: "real-estate",
    name: "Real estate & property management",
    short: "Owner, tenant and maintenance workflows in one place.",
    problems: [
      "Leases and renewals living in email",
      "Maintenance tickets with no owner",
      "Owners without a clear portfolio view",
    ],
    whatWeBuild: [
      "Owner and tenant portals",
      "Maintenance and inspection flows",
      "Reporting and document vaults",
    ],
  },
  {
    slug: "clinics",
    name: "Clinics & healthcare",
    short: "Scheduling, intake and follow-up without extra admin load.",
    problems: [
      "Double-booked calendars",
      "Paper intake and lost follow-ups",
      "Staff bouncing between tools",
    ],
    whatWeBuild: [
      "Booking and reminder systems",
      "Secure patient or client portals",
      "Internal ops dashboards",
    ],
  },
  {
    slug: "construction",
    name: "Construction & trades",
    short: "Jobs, quotes and site updates that match how crews actually work.",
    problems: [
      "Quotes rewritten in Word every time",
      "Site photos scattered across phones",
      "No live view of open jobs",
    ],
    whatWeBuild: [
      "Job and quote systems",
      "Field capture on mobile",
      "Client status pages",
    ],
  },
  {
    slug: "retail",
    name: "Retail & inventory",
    short: "Stock, orders and channels without nightly spreadsheet merges.",
    problems: [
      "Inventory out of sync across channels",
      "Manual order routing",
      "No clear low-stock signal",
    ],
    whatWeBuild: [
      "Inventory and order hubs",
      "Channel sync with retries",
      "Ops dashboards",
    ],
  },
  {
    slug: "professional-services",
    name: "Professional services",
    short: "Pipeline, delivery and retainers for firms that sell expertise.",
    problems: [
      "Leads dying without follow-up",
      "Projects tracked in email threads",
      "No shared view of capacity",
    ],
    whatWeBuild: [
      "CRM and delivery portals",
      "Proposal and billing hooks",
      "Resource and utilization views",
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
] as const;

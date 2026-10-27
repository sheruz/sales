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

export type ContentBlock = { title: string; body: string };

export type Service = {
  slug: ServiceSlug;
  name: string;
  short: string;
  headline: string;
  problem: string;
  /** How we approach the problem (paired with problem on the page) */
  approach: string;
  whoFor: string[];
  outcomes: string[];
  whatWeBuild: string[];
  /** Capability cards — Software Pro–style depth */
  capabilities: ContentBlock[];
  /** Realistic production shapes — no fake client names */
  useCases: ContentBlock[];
  deliverables: string[];
  whyUs: ContentBlock[];
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
    approach:
      "We map the real workflow first, then build a web product around it — auth, roles, APIs and the screens people use daily. Scope is written before build; you see working software every week.",
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
    capabilities: [
      {
        title: "SaaS and multi-tenant products",
        body: "Org boundaries, roles, entitlements and an admin path so a second customer does not mean a forked codebase.",
      },
      {
        title: "Internal tools and ops dashboards",
        body: "Dense screens for dispatch, inventory, approvals and reporting — built for people who live in the tool all day.",
      },
      {
        title: "Customer and partner portals",
        body: "Status, documents, tickets and self-serve flows so your clients stop calling for updates.",
      },
      {
        title: "APIs and integrations",
        body: "Stable APIs, webhooks and connectors to the systems you already pay for.",
      },
      {
        title: "Auth, roles and audit",
        body: "Sign-in, permissions and logs that match how your team actually works — including optional 2FA.",
      },
      {
        title: "Marketing site + app on one stack",
        body: "Public pages and the authenticated product in one Next.js deploy when that simplifies ops.",
      },
    ],
    useCases: [
      {
        title: "Ops tool that replaces the master spreadsheet",
        body: "One source of truth for jobs, stock or pipeline — with roles so the office and field see the right slice.",
      },
      {
        title: "B2B client portal",
        body: "Customers log in for status, files and requests instead of chasing email threads.",
      },
      {
        title: "Multi-tenant SaaS MVP",
        body: "Tenancy, billing hooks and an admin console — enough to onboard early customers without rewriting later.",
      },
      {
        title: "Admin console for an existing API",
        body: "Your backend already works; we ship the UI operators need to run it safely.",
      },
    ],
    deliverables: [
      "Written scope with milestones",
      "Design for core flows",
      "Production deploy + handover docs",
      "Weekly demos during build",
    ],
    whyUs: [
      {
        title: "Scope before code",
        body: "You approve a written plan in days — not after months of open-ended discovery.",
      },
      {
        title: "Weekly demos",
        body: "You click the product every week. Surprises show up while there is still time to steer.",
      },
      {
        title: "You own the repo",
        body: "Source, env templates and access maps transfer. We are not a black-box host.",
      },
      {
        title: "Timezone overlap",
        body: "US / UK / EU / Gulf hours so reviews happen live, not only overnight.",
      },
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
      {
        q: "SaaS platform vs internal tool?",
        a: "Same craft, different tenancy and billing. We write which shape you are buying into the scope.",
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
    approach:
      "We design for the job on site — capture, sync, push — then share one API with your web product so you do not maintain two backends.",
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
    capabilities: [
      {
        title: "Cross-platform apps",
        body: "React Native or Flutter so one team can ship iOS and Android without doubling every feature.",
      },
      {
        title: "Field capture",
        body: "Photos, signatures, GPS and documents that sync when signal returns.",
      },
      {
        title: "Push and reminders",
        body: "Job alerts, status changes and booking reminders that actually arrive.",
      },
      {
        title: "Shared backend with web",
        body: "Same auth and domain API as your portal or admin — no parallel truth.",
      },
      {
        title: "Store release pipeline",
        body: "Internal tracks, versioning and a checklist for App Store / Play submission.",
      },
      {
        title: "Offline-tolerant flows",
        body: "Queues and conflict rules for weak-signal sites and warehouses.",
      },
    ],
    useCases: [
      {
        title: "Driver or crew app",
        body: "Assignments, POD photos and status updates without calling the office.",
      },
      {
        title: "Customer companion app",
        body: "Bookings, status and chat-lite next to your existing web account.",
      },
      {
        title: "Inspection / checklist app",
        body: "Structured forms with photos that land in the job record automatically.",
      },
      {
        title: "Internal ops on phones",
        body: "Approvals and lookups for managers who are rarely at a desk.",
      },
    ],
    deliverables: [
      "Written mobile scope and device matrix",
      "TestFlight / Play internal tracks",
      "API contract with the backend",
      "Handover for store listing assets you provide",
    ],
    whyUs: [
      {
        title: "Phone-first scope",
        body: "We cut desktop-only fantasies and write what must work offline.",
      },
      {
        title: "One API",
        body: "Mobile and web share contracts so features do not drift.",
      },
      {
        title: "Weekly device demos",
        body: "You tap the build on a real phone — not only a simulator screenshot.",
      },
      {
        title: "Clear store ownership",
        body: "Your Apple / Google accounts; we prepare the binaries and notes.",
      },
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
      {
        q: "Can it work offline?",
        a: "When the scope says so — with an explicit sync and conflict plan.",
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
    approach:
      "We model your pipeline, jobs or stock as they actually run, migrate the data you care about, and integrate the tools that still earn their keep.",
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
    capabilities: [
      {
        title: "Sales pipeline and CRM",
        body: "Stages, tasks and follow-ups that match how your team sells — not a generic funnel template.",
      },
      {
        title: "Job and work-order systems",
        body: "From quote to delivery with change orders, docs and status your client can see.",
      },
      {
        title: "Inventory and warehouses",
        body: "Stock levels, movements and alerts without nightly spreadsheet merges.",
      },
      {
        title: "Reporting your board will trust",
        body: "Saved views and exports from the same data staff use day to day.",
      },
      {
        title: "Accounting and channel hooks",
        body: "Push invoices, pull payments or sync orders when those APIs exist.",
      },
      {
        title: "Migration and cutover",
        body: "Column maps, dry runs and a go-live window so you are not double-entering forever.",
      },
    ],
    useCases: [
      {
        title: "CRM that replaces the Excel pipeline",
        body: "Leads, stages and reminders with ownership — no more lost follow-ups in chat.",
      },
      {
        title: "Job system for trades or logistics",
        body: "Quotes, schedules, docs and invoices in one flow.",
      },
      {
        title: "Inventory hub across channels",
        body: "One stock number; connectors for the shops you already run.",
      },
      {
        title: "Hybrid: keep one SaaS, replace the painful slice",
        body: "We do not rip out what works — we write the boundary in the scope.",
      },
    ],
    deliverables: [
      "Process map + written scope",
      "Data migration plan",
      "Admin training notes",
      "Go-live checklist",
    ],
    whyUs: [
      {
        title: "Process first",
        body: "Screens follow your jobs — not the other way around.",
      },
      {
        title: "Honest replace vs keep",
        body: "We say when a vendor product is enough for a slice of the work.",
      },
      {
        title: "Migration as a milestone",
        body: "Cutover is planned and written — not a weekend surprise.",
      },
      {
        title: "Exit-friendly data",
        body: "Exports and APIs so you are never trapped in our schema.",
      },
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
      {
        q: "Can finance stay in QuickBooks / Xero?",
        a: "Yes — we integrate when those products expose APIs and list limits in the scope.",
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
    approach:
      "We wire models into your product with tools, roles and a review queue — BYOK keys, encrypted secrets and logs you can audit.",
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
    capabilities: [
      {
        title: "In-app assistants",
        body: "Copilots that read your records and propose actions — with permission checks on every tool call.",
      },
      {
        title: "Document and email intelligence",
        body: "Classify, extract and route PDFs, tickets and inbox threads into the right queue.",
      },
      {
        title: "Agents with guardrails",
        body: "Multi-step workflows that stop for human approval when the risk is high.",
      },
      {
        title: "Outreach and reply drafting",
        body: "Personalized drafts grounded in evidence (e.g. site audits) — not generic spam.",
      },
      {
        title: "BYOK and encrypted secrets",
        body: "Your OpenAI / Anthropic keys; we store credentials encrypted when we must hold them.",
      },
      {
        title: "Eval and cost controls",
        body: "Logging, rate limits and rough cost notes so AI does not surprise finance.",
      },
    ],
    useCases: [
      {
        title: "Support triage assistant",
        body: "Incoming messages classified and drafted — agent reviews before send.",
      },
      {
        title: "Document intake",
        body: "Invoices, applications or contracts parsed into structured fields for ops.",
      },
      {
        title: "Sales research + draft",
        body: "Enrich a lead and draft outreach that cites real findings from their site or CRM.",
      },
      {
        title: "Internal knowledge Q&A",
        body: "Staff ask questions against your docs with citations — not hallucinated policy.",
      },
    ],
    deliverables: [
      "Threat and data-flow notes for the AI surface",
      "Prompt and tool inventory",
      "Review queue UX",
      "Cost and rate-limit guidance",
    ],
    whyUs: [
      {
        title: "Workflow over widgets",
        body: "AI lands in the same product your team already uses.",
      },
      {
        title: "Human review when it matters",
        body: "High-risk sends and writes stay behind an approval step.",
      },
      {
        title: "Your keys",
        body: "BYOK by default — we do not force a shared vendor account.",
      },
      {
        title: "We run this ourselves",
        body: "Revenue OS uses the same class of patterns — audits, drafting, reply agents.",
      },
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
      {
        q: "Can we force human approval?",
        a: "Yes. Tool policies and review queues are part of the written scope.",
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
    approach:
      "We map the systems, pick custom vs light glue, and ship syncs with retries, idempotency and a place to see failures.",
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
    capabilities: [
      {
        title: "API and webhook bridges",
        body: "Two-way sync with clear ownership of which system is source of truth.",
      },
      {
        title: "Scheduled jobs",
        body: "Nightly imports, reminders and reconciliations with retries and dead-letter handling.",
      },
      {
        title: "Internal glue apps",
        body: "Small admin UIs when Zapier cannot express the rule cleanly.",
      },
      {
        title: "Idempotent imports",
        body: "Re-runs do not duplicate rows — reconciliation reports show drift.",
      },
      {
        title: "Event-driven flows",
        body: "React to CRM, billing or form events without polling forever.",
      },
      {
        title: "Observability",
        body: "Logs and alerts you can keep after handover — not a black box on our laptop.",
      },
    ],
    useCases: [
      {
        title: "CRM ↔ accounting sync",
        body: "Won deals create invoices; payment status flows back without retyping.",
      },
      {
        title: "Form to pipeline",
        body: "Website or ad leads land as structured opportunities with dedupe.",
      },
      {
        title: "Multi-channel inventory",
        body: "Stock updates fan out to shops with conflict rules written down.",
      },
      {
        title: "Ops alert bridge",
        body: "System events become Slack / email / ticket with rate limits.",
      },
    ],
    deliverables: [
      "Integration map",
      "Error and retry policy",
      "Runbooks for common failures",
      "Monitoring hooks you can keep",
    ],
    whyUs: [
      {
        title: "Reliability over duct tape",
        body: "We choose Zapier when it is enough — custom when silent failure is costly.",
      },
      {
        title: "Visible failures",
        body: "Retries and reports beat ‘it usually works’.",
      },
      {
        title: "Documented ownership",
        body: "Which system wins on conflict is written in the scope.",
      },
      {
        title: "Handover-ready",
        body: "Runbooks and credentials maps so your team can operate the sync.",
      },
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
      {
        q: "What if a vendor has no API?",
        a: "We say so early. Options may include export files, RPA-style bridges, or changing vendor — never pretend.",
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
    approach:
      "Fixed-price review first: risks, salvage vs rewrite, then a stabilization sprint you can see — before we talk about a long rebuild.",
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
    capabilities: [
      {
        title: "Code and architecture audit",
        body: "Repos, tests, deploy path, secrets handling and the real state of ‘done’.",
      },
      {
        title: "Salvage vs rewrite memo",
        body: "A clear recommendation with cost/risk — not a sales pitch for a greenfield rewrite.",
      },
      {
        title: "Stabilization sprint",
        body: "Fix the blockers that stop launch: auth, data, deploy, critical bugs.",
      },
      {
        title: "Delivery takeover",
        body: "We own the remaining milestones with weekly demos until launch.",
      },
      {
        title: "Vendor transition",
        body: "Access maps, repo hygiene and knowledge capture when the old team exits.",
      },
      {
        title: "Optional retainer after",
        body: "Same engineers for growth work once the fire is out.",
      },
    ],
    useCases: [
      {
        title: "Slippage with no working demo",
        body: "We restore a demoable build and a written path to production.",
      },
      {
        title: "Inherited codebase, no docs",
        body: "Audit + runbooks so your next hire is not flying blind.",
      },
      {
        title: "Almost launched, blocked on infra",
        body: "Deploy, env and monitoring fixed as a scoped sprint.",
      },
      {
        title: "Second opinion before rewrite",
        body: "Independent memo you can take to your board or another vendor.",
      },
    ],
    deliverables: [
      "Audit memo (risks, debt, go/no-go)",
      "Stabilization backlog",
      "Revised launch plan",
      "Optional ongoing retainer",
    ],
    whyUs: [
      {
        title: "Honesty before hours",
        body: "Review is fixed-price. We will tell you if walking away is smarter.",
      },
      {
        title: "Prefer salvage",
        body: "Rewrite only when the foundation cannot ship.",
      },
      {
        title: "Visible stabilization",
        body: "Weekly demos during the rescue — not a black-box ‘fix sprint’.",
      },
      {
        title: "Clean exit for the old vendor",
        body: "Access and docs so knowledge does not leave with them.",
      },
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
      {
        q: "Will you work with our stack?",
        a: "Usually yes. If we cannot, we say so in the review instead of learning on your dime.",
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
  approach: string;
  problems: string[];
  whatWeBuild: string[];
  modules: string[];
  capabilities: ContentBlock[];
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
    approach:
      "We replace chat-and-sheet dispatch with a board, documents and status your customers can see — without forcing a bloated TMS you will not use.",
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
    capabilities: [
      {
        title: "Dispatch board",
        body: "Open loads, assignments and status in one place for the office.",
      },
      {
        title: "Driver capture",
        body: "POD photos and signatures from the phone when the job needs it.",
      },
      {
        title: "Customer status",
        body: "A link or portal so shippers stop calling for updates.",
      },
      {
        title: "Document vault",
        body: "BOL, POD and invoices attached to the load — ready for billing.",
      },
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
    approach:
      "One system for units, leases, tickets and owner reporting — so renewals and maintenance stop living in inboxes.",
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
    capabilities: [
      {
        title: "Portfolio registry",
        body: "Properties, units and leases with the fields your PMs actually use.",
      },
      {
        title: "Maintenance tickets",
        body: "Owned tickets with status — vendors and tenants stop guessing.",
      },
      {
        title: "Owner reporting",
        body: "Portfolio snapshots without assembling a deck from five tools.",
      },
      {
        title: "Document vault",
        body: "Leases and notices attached to the right unit.",
      },
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
    approach:
      "Scheduling, intake and follow-ups in one ops layer — clinical systems stay with regulated vendors when they must.",
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
    capabilities: [
      {
        title: "Booking and reminders",
        body: "Calendars staff trust, with reminders you control.",
      },
      {
        title: "Digital intake",
        body: "Forms completed before the visit — data lands in the right queue.",
      },
      {
        title: "Follow-up queues",
        body: "Recalls and no-shows visible instead of lost in paper.",
      },
      {
        title: "Client portal",
        body: "Appointments and documents without calling the front desk.",
      },
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
    approach:
      "Quotes, jobs, site capture and client status in one flow — built for crews who are not at a desk.",
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
    capabilities: [
      {
        title: "Quote builder",
        body: "Reusable line items instead of rewriting Word every time.",
      },
      {
        title: "Job board",
        body: "Open jobs and owners visible to the office.",
      },
      {
        title: "Field capture",
        body: "Photos and notes attached to the job from site.",
      },
      {
        title: "Client status",
        body: "Updates without calling the owner for every question.",
      },
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
    approach:
      "A hub for stock and orders with channel sync and alerts — so staff stop merging sheets at midnight.",
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
    capabilities: [
      {
        title: "Stock hub",
        body: "One view of SKUs and locations staff can trust.",
      },
      {
        title: "Order inbox",
        body: "Orders from channels land in one queue for routing.",
      },
      {
        title: "Channel sync",
        body: "Retries and conflict rules when shops update stock.",
      },
      {
        title: "Reorder alerts",
        body: "Low-stock signals before you sell air.",
      },
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
    approach:
      "CRM, delivery and client status in one place — so partners see capacity before they promise dates.",
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
    capabilities: [
      {
        title: "Pipeline board",
        body: "Leads and stages with ownership and nudges for follow-up.",
      },
      {
        title: "Delivery workspace",
        body: "Projects and milestones without living in email threads.",
      },
      {
        title: "Capacity snapshot",
        body: "Partners see load before committing dates.",
      },
      {
        title: "Client portal",
        body: "Progress and files without weekly status theater.",
      },
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
  approach: string;
  whoFor: string[];
  includes: string[];
  capabilities: ContentBlock[];
  useCases: ContentBlock[];
  outcomes: string[];
  deliverables: string[];
  whyUs: ContentBlock[];
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
    approach:
      "We write a ruthless MVP scope — core flows in, everything else as explicit non-goals — then ship a production deploy you can put in front of users.",
    whoFor: [
      "Founders validating a workflow with real customers",
      "Operators replacing a painful spreadsheet with a thin product",
      "Teams that need a date, not an endless backlog",
    ],
    includes: [
      "Discovery and written MVP scope",
      "Core user flows only — explicit non-goals",
      "Production deploy you can put in front of users",
      "Backlog for version two, prioritized with you",
    ],
    capabilities: [
      {
        title: "Scope that cuts",
        body: "Non-goals written down so the MVP cannot silently grow mid-build.",
      },
      {
        title: "Core flow design",
        body: "The paths users must complete — not decorative screens.",
      },
      {
        title: "Production deploy",
        body: "Hosting, auth and basic monitoring so learning is real.",
      },
      {
        title: "v2 backlog",
        body: "Deferred work ranked with you after the first users touch it.",
      },
    ],
    useCases: [
      {
        title: "Internal tool MVP",
        body: "Replace the worst spreadsheet with one workflow staff will actually open.",
      },
      {
        title: "Customer portal MVP",
        body: "Login, status and one request type — enough to stop email chaos.",
      },
      {
        title: "SaaS wedge",
        body: "One persona, one job-to-be-done, tenancy ready for a second customer.",
      },
      {
        title: "Mobile + API wedge",
        body: "Field capture and a thin admin — shared backend from day one.",
      },
    ],
    outcomes: [
      "Something real to learn from — not a pitch deck",
      "Clear list of what was deferred and why",
      "Code you can keep extending",
    ],
    deliverables: [
      "Written MVP scope and non-goals",
      "Weekly demos",
      "Production URL + handover notes",
      "Prioritized v2 backlog",
    ],
    whyUs: [
      {
        title: "Honest cuts",
        body: "We will say no to features that blow the date.",
      },
      {
        title: "Real deploy",
        body: "MVP means users can touch it — not a Figma walkthrough.",
      },
      {
        title: "You own the code",
        body: "Extend with us or with your next hire.",
      },
      {
        title: "Same process as larger builds",
        body: "Written scope and weekly demos — just a smaller cut.",
      },
    ],
    relatedServiceSlugs: ["web-apps", "mobile-apps", "ai-integrations"],
    faq: [
      {
        q: "How small is an MVP?",
        a: "Small enough to demo weekly and launch on a date you approve in the scope. We cut features in writing, not by surprise.",
      },
      {
        q: "Can we add features mid-MVP?",
        a: "Yes via a written change — timeline and price update together.",
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
    approach:
      "We build the platform spine first — orgs, roles, entitlements, billing hooks and an ops console — then the features that sit on top.",
    whoFor: [
      "Founders selling software to other businesses",
      "Agencies productizing a delivery into a SaaS",
      "Teams stuck on a single-tenant fork per customer",
    ],
    includes: [
      "Tenant isolation and role models",
      "Plans, credits or seats — wired to a billing provider",
      "Super-admin / ops console",
      "BYOK integrations and encrypted secrets when required",
    ],
    capabilities: [
      {
        title: "Tenant isolation",
        body: "Org boundaries in the data model and queries — not hope.",
      },
      {
        title: "Roles and entitlements",
        body: "Plans map to features staff and customers can actually use.",
      },
      {
        title: "Billing hooks",
        body: "Paddle, Stripe or your provider — checkout and webhooks in scope.",
      },
      {
        title: "Super-admin console",
        body: "Support tenants, packages and flags without SSH folklore.",
      },
      {
        title: "Audit and 2FA",
        body: "When the threat model needs them — written into the build.",
      },
      {
        title: "BYOK integrations",
        body: "Customers bring API keys; we encrypt what we store.",
      },
    ],
    useCases: [
      {
        title: "B2B SaaS from day one",
        body: "Onboard customer two without cloning the database.",
      },
      {
        title: "Agency productized offering",
        body: "Your delivery becomes a tenanted product with billing.",
      },
      {
        title: "Credits / usage products",
        body: "Plans and ledgers for consumable work (audits, sends, seats).",
      },
      {
        title: "White-label ops",
        body: "Admin tools so your team supports tenants without engineering.",
      },
    ],
    outcomes: [
      "You can onboard a second customer without forking the codebase",
      "Billing and entitlements match what you sell",
      "Ops can support tenants without SSH folklore",
    ],
    deliverables: [
      "Tenancy and role design doc",
      "Billing integration in scope",
      "Admin console for ops",
      "Handover of repos and env maps",
    ],
    whyUs: [
      {
        title: "We run one",
        body: "Delvix Revenue OS is multi-tenant with billing, admin and BYOK — see /work/revenue-os.",
      },
      {
        title: "Spine before features",
        body: "Tenancy and entitlements early so you do not rewrite later.",
      },
      {
        title: "Security basics included",
        body: "Isolation, secrets and audit where the product needs them.",
      },
      {
        title: "Exit-friendly",
        body: "You own the code and the customer relationship.",
      },
    ],
    relatedServiceSlugs: ["web-apps", "ai-integrations", "automation"],
    faq: [
      {
        q: "Have you built this before?",
        a: "Yes — including Delvix Revenue OS, our own multi-tenant acquisition platform. See /work/revenue-os.",
      },
      {
        q: "Which billing provider?",
        a: "We integrate what you choose (e.g. Paddle or Stripe) and write webhooks into the scope.",
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
    approach:
      "Named engineers on your tools and backlog, with demos and written expectations — capacity you can scale month to month.",
    whoFor: [
      "Product teams with a clear backlog and no hire yet",
      "Companies that need a senior pair for a workstream",
      "Teams coming out of a rescue who want continuity",
    ],
    includes: [
      "Named engineer(s) on your tools and standups",
      "Agreed capacity each month",
      "Backlog you prioritize",
      "Flexible month-to-month after the first period",
    ],
    capabilities: [
      {
        title: "Embedded cadence",
        body: "Standups, PRs and demos in your tools — not a parallel process.",
      },
      {
        title: "Owned workstream",
        body: "Clear slice of the product with accountability.",
      },
      {
        title: "Flexible capacity",
        body: "Scale up for a launch; scale down when the rush ends.",
      },
      {
        title: "Knowledge in your repos",
        body: "Docs and code stay with you when the engagement ends.",
      },
    ],
    useCases: [
      {
        title: "Bridge to hire",
        body: "Ship while you recruit a full-time engineer.",
      },
      {
        title: "Feature squad",
        body: "A pod owns one initiative end to end.",
      },
      {
        title: "Post-rescue continuity",
        body: "Same people who stabilized stay for growth work.",
      },
      {
        title: "Part-time senior",
        body: "Architecture and hard tickets without a full FTE.",
      },
    ],
    outcomes: [
      "Velocity without a full-time hire risk",
      "Knowledge stays in your repos and docs",
      "Easy to scale down when the rush ends",
    ],
    deliverables: [
      "Named roster and capacity agreement",
      "Weekly demos / PR rhythm",
      "Shared backlog board",
      "Monthly written summary",
    ],
    whyUs: [
      {
        title: "Direct access",
        body: "You talk to the people writing the code.",
      },
      {
        title: "Quality bar",
        body: "Demos and review — not only hours logged.",
      },
      {
        title: "Your repos",
        body: "No shadow codebase on our side.",
      },
      {
        title: "Clean off-ramp",
        body: "Month-to-month after the first period.",
      },
    ],
    relatedServiceSlugs: ["web-apps", "mobile-apps", "project-rescue"],
    faq: [
      {
        q: "Is this staff augmentation?",
        a: "Close — with written expectations, demos and ownership of delivery quality, not just hours logged.",
      },
      {
        q: "Minimum term?",
        a: "Confirmed in the proposal. Usually a first month, then month-to-month.",
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
    approach:
      "Short fixed engagement: interviews, process map, risks, then a written scope with milestones you can bid or build against.",
    whoFor: [
      "Buyers who need a scope before committing to build",
      "Teams mid-rescue who need an honest plan",
      "Stakeholders who want a document they can share with another vendor",
    ],
    includes: [
      "Stakeholder interviews and process mapping",
      "Risk and dependency list",
      "Written scope, milestones and assumptions",
      "Ballpark or fixed-price build option",
    ],
    capabilities: [
      {
        title: "Process mapping",
        body: "How work actually moves today — including the shadow spreadsheets.",
      },
      {
        title: "Risk register",
        body: "Integrations, data, compliance and open questions called out early.",
      },
      {
        title: "Build-ready scope",
        body: "Milestones, assumptions and non-goals — not a vague brochure.",
      },
      {
        title: "Pricing path",
        body: "Fixed-price or capacity options for the build that follows.",
      },
    ],
    useCases: [
      {
        title: "Greenfield product",
        body: "Turn a pitch into a scope before hiring a team.",
      },
      {
        title: "Replace a legacy tool",
        body: "Map migration and cutover before writing code.",
      },
      {
        title: "Second opinion",
        body: "Independent scope you can take to another bidder.",
      },
      {
        title: "Stuck project",
        body: "Reset assumptions after a slipped vendor engagement.",
      },
    ],
    outcomes: [
      "A document you can send to another vendor if you want a second bid",
      "Fewer surprise change orders later",
      "Clear go / no-go",
    ],
    deliverables: [
      "Interview notes summary",
      "Process / system map",
      "Written scope + assumptions",
      "Build estimate options",
    ],
    whyUs: [
      {
        title: "Fixed, short",
        body: "Discovery is priced and timed — not endless.",
      },
      {
        title: "Portable artifact",
        body: "You can build with us or take the scope elsewhere.",
      },
      {
        title: "No fake certainty",
        body: "Open risks stay on the page until resolved.",
      },
      {
        title: "Leads into build cleanly",
        body: "Same team can execute the scope without re-discovery tax.",
      },
    ],
    relatedServiceSlugs: ["project-rescue", "erp-crm", "web-apps"],
    faq: [
      {
        q: "Is discovery free?",
        a: "The intro call is free. A full discovery with a written scope is a short fixed engagement — priced up front.",
      },
      {
        q: "Must we build with you after?",
        a: "No. The scope is yours.",
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

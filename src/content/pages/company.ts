// Company-level page content for Delvix Studio.
// Rules: no invented numbers, clients, awards, or certifications. No invented prices.
// Pricing starter offers live in siteConfig.offers elsewhere.

import { siteConfig } from "../site";
import type { FaqItem } from "./types";

type TitledBody = { title: string; body: string };

/* -------------------------------------------------------------------------- */
/* About                                                                       */
/* -------------------------------------------------------------------------- */

export type AboutPageContent = {
  seoTitle: string;
  seoDescription: string;
  h1: string;
  intro: string;
  mission: { title: string; body: string };
  principles: TitledBody[]; // 5
  workingHours: {
    title: string;
    body: string;
    regions: string[];
    overlapNote: string;
    points: string[];
  };
  founderStory: { enabled: boolean; todoMarker: string; body: string };
};

export const aboutPage: AboutPageContent = {
  seoTitle: "About Delvix Studio | Remote Software Team",
  seoDescription:
    "Delvix Studio is a remote software studio that builds websites, web apps, mobile apps, and automation for small and mid-sized businesses. Learn how we work.",
  h1: "A software studio built around clear communication and finished work",
  intro:
    "Delvix Studio builds websites, web and mobile applications, and automation for businesses that have outgrown spreadsheets, email threads, and off-the-shelf tools that almost fit. We work remotely with vetted developers and keep the process simple: we listen, we scope in plain language, we show progress often, and we hand over code and documentation that you own.",
  mission: {
    title: "Our mission",
    body: "To help small and mid-sized businesses replace manual, error-prone work with software that fits how they operate, and to do it with honest scoping, steady communication, and no surprises in what you receive.",
  },
  principles: [
    {
      title: "Say what we know and what we do not",
      body: "We tell you when something is uncertain, when a feature is more than you need, and when a different tool would serve you better. A recommendation that costs us a project is still the right recommendation.",
    },
    {
      title: "Small, working steps over big reveals",
      body: "We aim to put something real in front of you early and often, so you can react while changes are still cheap. You should never wait months to find out whether we understood you.",
    },
    {
      title: "Build for the people who use it",
      body: "Software succeeds when the dispatcher, the front desk, or the crew lead actually adopts it. We design around the daily work of those users and test with them where we can.",
    },
    {
      title: "You own what you pay for",
      body: "Code ownership transfers to you on final payment. We use mainstream tools and leave documentation so you are never dependent on us to keep your software running.",
    },
    {
      title: "Plain language, always",
      body: "Proposals, updates, and invoices should be readable by someone who does not write code. If we cannot explain a decision simply, we have not thought it through enough.",
    },
  ],
  workingHours: {
    title: "Time zones and working hours",
    body: "We are a remote team, and we keep working-hour overlap with the regions most of our clients are in, so reviews and decisions can happen live instead of only overnight.",
    regions: ["United States", "United Kingdom", "Europe", "Gulf"],
    overlapNote:
      "At kickoff we agree on a regular overlap window for calls in your time zone, and we adjust it when a milestone needs extra live time.",
    points: [
      "Questions sent at the end of your day are typically picked up at the start of ours, so work can keep moving while you are offline.",
      "Written updates mean you do not need to be on a call to know where things stand.",
      "Scheduled calls and weekly demos happen in the overlap window we agree with you.",
      "Public holidays differ by country. We tell you about planned time off in advance so it does not surprise your schedule.",
    ],
  },
  // Keep disabled until a real founder story is written. UI should hide the section while enabled is false.
  founderStory: { enabled: false, todoMarker: "TODO_FOUNDER", body: "" },
};

/* -------------------------------------------------------------------------- */
/* Process (detailed)                                                          */
/* -------------------------------------------------------------------------- */

export type ProcessStep = {
  number: number;
  title: string;
  summary: string;
  whatWeDo: string;
  whatYouGet: string[];
};

export type ProcessPageContent = {
  seoTitle: string;
  seoDescription: string;
  h1: string;
  intro: string;
  steps: ProcessStep[]; // 6
  communication: {
    title: string;
    body: string;
    tools: TitledBody[];
  };
  sampleWeek: {
    title: string;
    intro: string;
    days: Array<{ day: string; focus: string }>;
    note: string;
  };
};

export const processPageDetailed: ProcessPageContent = {
  seoTitle: "How We Work | Our Software Development Process | Delvix Studio",
  seoDescription:
    "See how Delvix Studio takes a project from first conversation to launch and support in six clear steps, with defined deliverables at every stage.",
  h1: "How we work: six steps, with something tangible at the end of each",
  intro:
    "Every project is different, but the shape of the work is consistent. Here is what happens at each stage and what you receive, so you always know what comes next.",
  steps: [
    {
      number: 1,
      title: "Discovery call",
      summary: "We learn how your business works and what is not working.",
      whatWeDo:
        "A conversation, usually by video, about your goals, your current tools and processes, who will use the software, and any deadlines or constraints. We ask a lot of questions and may ask to see your current spreadsheets, forms, or website.",
      whatYouGet: [
        "A short written summary of what we understood, so you can correct us early",
        "Honest feedback on whether custom software is the right answer",
        "A list of open questions and what we need from you",
      ],
    },
    {
      number: 2,
      title: "Scope and proposal",
      summary: "We turn the conversation into a plan you can evaluate.",
      whatWeDo:
        "We define what is in the first release, what is deliberately left for later, and how the work will be done. We recommend an engagement model and technology choices, explaining the trade-offs in plain language.",
      whatYouGet: [
        "A written proposal with scope, deliverables, and assumptions",
        "A recommended engagement model (fixed-price, dedicated, or retainer)",
        "A clear statement of what is and is not included",
        "A quote based on that scope",
      ],
    },
    {
      number: 3,
      title: "Design and planning",
      summary: "You see what it will look like before it is built.",
      whatWeDo:
        "We map the key workflows and sketch the screens. For most projects this means wireframes or simple designs for the important flows, plus a data model and technical plan behind the scenes.",
      whatYouGet: [
        "Wireframes or designs of the main screens for your review",
        "A workflow map showing who does what, and when",
        "A short technical plan covering the stack, hosting, and integrations",
        "A prioritized list of features for the build",
      ],
    },
    {
      number: 4,
      title: "Build in short cycles",
      summary: "We develop in small increments and show working software.",
      whatWeDo:
        "Development happens in short cycles. At the end of each cycle we show you what works and collect feedback. We keep a task list you can see, and we flag risks and trade-offs as they appear rather than at the end.",
      whatYouGet: [
        "Regular working demos on a test link you can click through",
        "Written progress updates",
        "A visible task list showing what is done, in progress, and next",
        "A chance to adjust priorities between cycles within the agreed model",
      ],
    },
    {
      number: 5,
      title: "Testing and launch",
      summary: "We check it carefully, then put it in front of real users.",
      whatWeDo:
        "We test the main workflows, check how the software behaves on different devices, and fix issues found during review. We help set up hosting, domains, and backups, plan the switch from your old process, and support the launch itself.",
      whatYouGet: [
        "A staging version for your team to review and approve",
        "A launch checklist and a rollback plan where relevant",
        "Production hosting set up in an account you control or can take over",
        "Short guidance for your team on how to use the software",
      ],
    },
    {
      number: 6,
      title: "Handover and support",
      summary: "You own it, and we stay available if you want us.",
      whatWeDo:
        "On final payment, ownership of the code transfers to you. We hand over the repository, setup notes, and credentials management guidance. After launch, you can continue with us on a retainer, move to your own team, or do a mix.",
      whatYouGet: [
        "Ownership of the code on final payment",
        "Documentation on how to run, deploy, and maintain the project",
        "A walkthrough session with you or your developers",
        "Optional ongoing support through a retainer",
      ],
    },
  ],
  communication: {
    title: "How we communicate",
    body: "We agree on a communication rhythm at the start and stick to it. The goal is that you can always find out where things stand without chasing us.",
    tools: [
      {
        title: "Shared messaging channel",
        body: "A shared channel in the tool your team already uses, or email if you prefer, for day-to-day questions and quick decisions.",
      },
      {
        title: "Video calls",
        body: "Scheduled calls for kickoff, demos, and key decisions, held in the overlap window we agree with you.",
      },
      {
        title: "Written updates",
        body: "A summary of what was done, what is next, and anything blocking progress, delivered on the schedule we agree to.",
      },
      {
        title: "Visible task tracking",
        body: "A board or list you can open at any time to see the status of each piece of work.",
      },
      {
        title: "Test links",
        body: "A working version you can click through as it develops, rather than screenshots after the fact.",
      },
    ],
  },
  sampleWeek: {
    title: "What a typical week looks like during the build",
    intro:
      "Rhythms vary by project and engagement model. This is an illustration of a common pattern, not a guarantee of a particular schedule.",
    days: [
      {
        day: "Monday",
        focus: "Plan the week. We confirm priorities and review open questions with you in a short check-in.",
      },
      {
        day: "Tuesday",
        focus: "Build. Developers work on the priority items. We post questions in the shared channel as they arise.",
      },
      {
        day: "Wednesday",
        focus: "Build and internal review. Work is checked before it is shown to you.",
      },
      {
        day: "Thursday",
        focus: "Demo. We show what works on a test link and collect your feedback.",
      },
      {
        day: "Friday",
        focus: "Adjust and summarize. We apply feedback, update the task list, and send a written summary of the week and what is next.",
      },
    ],
    note: "For fixed-price projects the scope is agreed up front, so weekly feedback is used to refine within that scope. In dedicated and retainer models, priorities can shift week to week.",
  },
};

/* -------------------------------------------------------------------------- */
/* Pricing                                                                     */
/* -------------------------------------------------------------------------- */

export type EngagementModel = {
  id: "fixed-price" | "dedicated" | "retainer";
  name: string;
  tagline: string;
  bestFor: string;
  howItWorks: string;
  includes: string[];
  tradeOffs: string;
};

export type PricingPageContent = {
  seoTitle: string;
  seoDescription: string;
  h1: string;
  intro: string;
  noPricesNote: string;
  models: EngagementModel[]; // 3
  whatAffectsPrice: string[];
  starterOffersNote: string; // starterOffers themselves are rendered from siteConfig.offers
  faq: FaqItem[];
};

export const pricingPage: PricingPageContent = {
  seoTitle: "Pricing & Engagement Models | Delvix Studio",
  seoDescription:
    "Choose a fixed-price project, a dedicated developer, or a monthly retainer. See what is included in each and what affects the cost of your project.",
  h1: "Three ways to work with us, and what actually affects the price",
  intro:
    "Software projects vary too much for one price list to be honest. Instead, we offer three engagement models and give you a written quote once we understand your scope. Here is how each model works and what to expect.",
  noPricesNote:
    "We do not publish fixed prices for custom work because the range between a simple site and a multi-role application is too wide to be useful. You get a written quote after the discovery call.",
  models: [
    {
      id: "fixed-price",
      name: "Fixed-price project",
      tagline: "A defined scope for an agreed price.",
      bestFor:
        "Projects with a clear goal and a scope you can describe, such as a new website, a quote tool, a portal, or a first version of a product.",
      howItWorks:
        "We agree on scope, deliverables, and assumptions in writing, and you receive a quote for that scope. Changes beyond the agreed scope go through a simple change request so you see the effect on cost and timing before we proceed.",
      includes: [
        "Discovery and a written scope",
        "Design of key screens or workflows",
        "Development and testing",
        "A staging version for your review",
        "Launch support",
        "Code ownership on final payment",
        "Handover documentation",
      ],
      tradeOffs:
        "You get cost certainty and a clear finish line. In exchange, scope is more fixed, so large changes of direction mean a change request or a new phase.",
    },
    {
      id: "dedicated",
      name: "Dedicated developer or team",
      tagline: "Focused capacity that works as an extension of your team.",
      bestFor:
        "Products that evolve continuously, teams that need more engineering capacity, or projects where priorities will change as you learn.",
      howItWorks:
        "One or more vetted developers work on your priorities for an agreed period, billed on a regular schedule. You direct the priorities, and we handle day-to-day delivery with regular check-ins and written updates.",
      includes: [
        "Developer time dedicated to your project",
        "Regular check-ins and written updates",
        "Flexibility to reprioritize as you learn",
        "Work inside your repository and review process, or ours",
        "A shared task board",
        "Code ownership on final payment",
      ],
      tradeOffs:
        "You get flexibility and continuity. In exchange, the total cost depends on how long you keep the engagement, so it works best when someone on your side owns priorities.",
    },
    {
      id: "retainer",
      name: "Monthly retainer",
      tagline: "Ongoing care for software that is already live.",
      bestFor:
        "Websites and applications that need updates, fixes, and improvements without a full project each time.",
      howItWorks:
        "You reserve an agreed amount of our time each month for maintenance, small improvements, and support. We track the work, report on it, and flag anything that needs a larger piece of work.",
      includes: [
        "A monthly allocation of development time",
        "Bug fixes and small improvements",
        "Dependency and security updates",
        "Hosting and backup monitoring where agreed",
        "A simple request process and written summaries",
      ],
      tradeOffs:
        "You get a team that already knows your system and is easy to reach. In exchange, it is intended for ongoing upkeep and incremental work, not for large new builds, which are better handled as a separate project.",
    },
  ],
  whatAffectsPrice: [
    "The number of user types and the permissions each one needs",
    "How many screens and workflows are in the first release",
    "Integrations with other software, and how well their APIs are documented",
    "Whether you need a mobile app, a web app, or both",
    "Data migration from spreadsheets or an older system, and how clean that data is",
    "Custom design work versus using a clean, standard interface",
    "AI features, which add testing, review steps, and ongoing usage costs",
    "Hosting, compliance, and security requirements specific to your industry",
    "How quickly you need it, since tight deadlines can require more people at once",
    "How clearly the requirements are defined, and how fast your team can give feedback",
  ],
  starterOffersNote:
    "If you want a smaller starting point, see our starter offers. They are defined packages with a clear scope.",
  faq: [
    {
      q: "Why do you not list prices for custom projects?",
      a: "Because a quote based on guesses would either be too high to be fair or too low to be honest. We prefer to scope first, then quote.",
    },
    {
      q: "How do I get a quote?",
      a: "Book a discovery call or send us a message describing what you need. We will follow up with questions and, once we understand the scope, a written proposal.",
    },
    {
      q: "How do payments work?",
      a: "Payment terms are set out in your proposal. Fixed-price work is typically tied to milestones, and dedicated and retainer work is billed on a regular schedule. We spell out the details before you sign.",
    },
    {
      q: "What happens if the scope changes mid-project?",
      a: "On fixed-price work, we write up the change and show the cost and timing impact before doing it. In the dedicated and retainer models, you adjust priorities directly.",
    },
    {
      q: "Do I own the code?",
      a: "Yes. Code ownership transfers to you on final payment.",
    },
    {
      q: "Can I switch models later?",
      a: "Yes. Many clients build with a fixed-price project and then move to a retainer after launch, or move to a dedicated developer as the product grows.",
    },
    {
      q: "Are there ongoing costs after launch?",
      a: "Usually yes, for hosting, domains, third-party services, and any maintenance you want us to handle. We estimate these up front so they do not surprise you.",
    },
  ],
};

/* -------------------------------------------------------------------------- */
/* Security                                                                    */
/* -------------------------------------------------------------------------- */

export type SecurityPageContent = {
  seoTitle: string;
  seoDescription: string;
  h1: string;
  intro: string;
  commitments: TitledBody[];
  honestyNote: { title: string; body: string };
  yourResponsibilities: string[];
  faq: FaqItem[];
};

export const securityPageDetailed: SecurityPageContent = {
  seoTitle: "Security & Data Handling | Delvix Studio",
  seoDescription:
    "How Delvix Studio handles code ownership, NDAs, access control, credentials, backups, and client data. Plain statements, no inflated claims.",
  h1: "How we handle your code, access, and data",
  intro:
    "You are trusting us with your business processes and sometimes your customers' information. Here is what we do, in plain terms, and what we do not claim.",
  commitments: [
    {
      title: "Code ownership",
      body: "Ownership of the code we write for you transfers to you on final payment. We use mainstream technologies and provide handover documentation so you can run and maintain the project without us.",
    },
    {
      title: "NDA on request",
      body: "We are happy to sign a non-disclosure agreement before you share details about your business or idea. Just ask at the start of the conversation.",
    },
    {
      title: "Access control",
      body: "We limit access to your code, servers, and data to the people working on your project, and we give each person only the access their role requires. When someone leaves a project, their access is removed.",
    },
    {
      title: "Encrypted credentials",
      body: "Passwords, API keys, and other secrets are stored in encrypted configuration or a secrets manager, not in the code repository and not shared in plain text over chat or email.",
    },
    {
      title: "Backups",
      body: "For projects we host or set up, we configure backups of databases and important files and explain how restoring works. The schedule and retention are agreed for each project.",
    },
    {
      title: "Client data handling",
      body: "We use your data only to do the work you hired us for. We prefer test or sample data in development where possible, and we limit use of production data to what the task requires. We do not sell your data.",
    },
    {
      title: "Hosting in accounts you control",
      body: "Wherever practical, we set up hosting and third-party services in accounts that belong to your business, so you are never dependent on us to access your own systems.",
    },
    {
      title: "Safer AI usage",
      body: "When a project uses AI model APIs, we review the provider's current data terms with you, avoid sending more data than needed, and keep a person in the loop for important decisions.",
    },
  ],
  honestyNote: {
    title: "What we do not claim",
    body: "We do not currently hold formal security certifications or audit attestations, and we will not suggest otherwise. If your industry requires specific compliance, such as for health or financial data, we will discuss the requirements with you and your advisors up front and tell you honestly whether we can meet them for your project.",
  },
  yourResponsibilities: [
    "Use strong, unique passwords and multi-factor authentication on the accounts you own",
    "Tell us promptly if someone with access leaves your company",
    "Let us know before the project begins if you handle regulated data",
    "Keep the contact for security issues up to date",
  ],
  faq: [
    {
      q: "Are you SOC 2 or ISO 27001 certified?",
      a: "No. We do not hold those certifications and do not claim to. We explain our practices openly so you can judge whether they fit your needs.",
    },
    {
      q: "Can you sign our NDA?",
      a: "Yes. We can sign an NDA on request, either ours or yours, before you share confidential information.",
    },
    {
      q: "Who can see my code and data?",
      a: "Only the people assigned to your project, with access limited to what they need. We can describe the specific access arrangement for your project on request.",
    },
    {
      q: "What happens to my data when the project ends?",
      a: "We hand over what you own and remove our access to your systems. We can discuss deletion of any project data we hold, as part of wrapping up.",
    },
    {
      q: "What if there is a security issue after launch?",
      a: "If you are on a retainer or support plan, security fixes are part of the work. If not, contact us and we will advise on options. We will tell you promptly if we learn of an issue that affects your project.",
    },
  ],
};

/* -------------------------------------------------------------------------- */
/* Careers                                                                     */
/* -------------------------------------------------------------------------- */

export type CareersPageContent = {
  seoTitle: string;
  seoDescription: string;
  h1: string;
  intro: string;
  howToApply: {
    title: string;
    steps: string[];
    email: string;
    emailNote: string;
  };
  whatToInclude: string[];
  whatWeLookFor: string[];
  note: string;
};

export const careersPage: CareersPageContent = {
  seoTitle: "Careers | Work With Delvix Studio",
  seoDescription:
    "Delvix Studio works with vetted remote developers. Send us your portfolio to be considered for upcoming projects.",
  h1: "Work with Delvix Studio",
  intro:
    "We work with vetted remote developers. If you build web, mobile, or automation software and want to work on real business projects, send us your portfolio.",
  howToApply: {
    title: "How to apply",
    steps: [
      "Send an email with your portfolio and a short introduction.",
      "We review it and reply if there is a fit for a current or upcoming project.",
      "If there is a fit, we talk and may ask for a short paid or unpaid sample task, which we will define clearly in advance.",
    ],
    email: siteConfig.contact.email,
    emailNote:
      "We read every message but may not be able to reply to each one. Not hearing back quickly does not necessarily mean no.",
  },
  whatToInclude: [
    "Links to projects you have built, live or in a repository, and your role in each",
    "The technologies you work with most",
    "Your time zone and typical availability",
    "A few lines about the kind of work you enjoy",
  ],
  whatWeLookFor: [
    "Clear written communication in English",
    "Experience with some of: Next.js, React, Node.js, Laravel, Python, React Native, Flutter, PostgreSQL, or AWS",
    "Pride in finishing and handing over work that others can maintain",
    "Honesty about what you know and what you do not",
  ],
  note: "Delvix Studio does not currently list specific open roles. We reach out to vetted developers as projects need them.",
};

/* -------------------------------------------------------------------------- */
/* Free audit                                                                  */
/* -------------------------------------------------------------------------- */

type FormFieldContent = {
  name: string;
  label: string;
  type: "text" | "email" | "url" | "select" | "textarea" | "tel";
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
};

export type FreeAuditPageContent = {
  seoTitle: string;
  seoDescription: string;
  h1: string;
  intro: string;
  whatWeCheck: TitledBody[];
  reportDescription: {
    title: string;
    body: string;
    includes: string[];
  };
  howItWorks: string[];
  form: {
    title: string;
    fields: FormFieldContent[];
    submitLabel: string;
    consentLabel: string;
    successMessage: string;
  };
  honestNote: string;
  faq: FaqItem[];
};

export const freeAuditPage: FreeAuditPageContent = {
  seoTitle: "Free Website Audit | Delvix Studio",
  seoDescription:
    "Get a free website audit from Delvix Studio. We check mobile speed, broken pages and links, forms, SSL, mobile layout, and calls to action, and send a real report with screenshots.",
  h1: "Get a free website audit",
  intro:
    "Tell us your website address and we will review it. You will get a written report with screenshots showing what we found and what to fix first, whether or not you ever hire us.",
  whatWeCheck: [
    {
      title: "Mobile speed",
      body: "How quickly your pages load and become usable on a phone, and which images or scripts are slowing them down.",
    },
    {
      title: "Broken pages and links",
      body: "Links that lead nowhere, missing pages, and errors that visitors and search engines run into.",
    },
    {
      title: "Forms",
      body: "Whether your contact, quote, or booking forms work, are easy to complete on a phone, and give the visitor a clear confirmation.",
    },
    {
      title: "SSL and basic security signals",
      body: "Whether your site is served securely over HTTPS and whether the browser shows any warnings to visitors.",
    },
    {
      title: "Mobile layout",
      body: "Whether text, buttons, and images display properly on typical phone screens, without side-scrolling or overlapping elements.",
    },
    {
      title: "Calls to action",
      body: "Whether it is obvious what a visitor should do next, and whether the main action, such as call, book, or request a quote, is easy to find.",
    },
  ],
  reportDescription: {
    title: "What you receive",
    body: "A real report prepared from your actual site, not a generic template. It uses screenshots to show the issues in context and lists suggested fixes in order of priority.",
    includes: [
      "Annotated screenshots of the issues we found",
      "A plain-language explanation of why each issue matters",
      "A prioritized list of suggested fixes",
      "Notes on what you can fix yourself and what may need a developer",
    ],
  },
  howItWorks: [
    "Fill in the short form with your website address and contact details.",
    "We review your site against the checklist above.",
    "We send you the report, usually within a few business days.",
    "If you want help fixing anything, we can talk. If you do not, the report is still yours to keep.",
  ],
  form: {
    title: "Request your free audit",
    fields: [
      {
        name: "name",
        label: "Your name",
        type: "text",
        required: true,
        placeholder: "Jane Smith",
      },
      {
        name: "email",
        label: "Work email",
        type: "email",
        required: true,
        placeholder: "jane@yourcompany.com",
        helpText: "We will send the report to this address.",
      },
      {
        name: "company",
        label: "Company name",
        type: "text",
        required: false,
        placeholder: "Your company",
      },
      {
        name: "website",
        label: "Website address",
        type: "url",
        required: true,
        placeholder: "https://www.yourcompany.com",
      },
      {
        name: "industry",
        label: "Industry",
        type: "select",
        required: false,
        options: [
          "Logistics & Trucking",
          "Real Estate",
          "Healthcare & Clinics",
          "Construction & Trades",
          "Retail & Inventory",
          "Professional Services",
          "Education",
          "Startup or SaaS",
          "Other",
        ],
      },
      {
        name: "concern",
        label: "Anything specific you want us to look at?",
        type: "textarea",
        required: false,
        placeholder: "For example: our quote form, how the site looks on phones, or why we get few inquiries.",
      },
    ],
    submitLabel: "Send me my free audit",
    consentLabel:
      "I agree that Delvix Studio may contact me about this audit and my website.",
    successMessage:
      "Thanks, we have received your request. We will review your site and send your report by email.",
  },
  honestNote:
    "The audit is a review of your public website. It is a starting point for finding problems, not a full security test or a guarantee of search ranking.",
  faq: [
    {
      q: "Is the audit really free?",
      a: "Yes. There is no charge and no obligation to hire us.",
    },
    {
      q: "Will I be pressured to buy something?",
      a: "No. If you want help with the findings we are happy to talk, but the report is yours either way.",
    },
    {
      q: "How long does it take?",
      a: "We aim to send the report within a few business days, depending on how many requests we have.",
    },
    {
      q: "Do you need access to my website?",
      a: "No. We review your public site the way a visitor sees it. We do not need logins.",
    },
    {
      q: "Can you audit software, not just websites?",
      a: "The free audit covers public websites. If you want a review of a web app or internal tool, contact us and we can discuss options.",
    },
  ],
};

/* -------------------------------------------------------------------------- */
/* Contact extras                                                              */
/* -------------------------------------------------------------------------- */

export type ContactType = {
  id: "quote" | "call" | "partnership";
  label: string;
  description: string;
  suggestedInfo: string[];
};

export type ContactPageExtras = {
  responseTime: string;
  responseTimeNote: string;
  types: ContactType[]; // 3
  formLabels: {
    name: string;
    email: string;
    company: string;
    type: string;
    message: string;
    submit: string;
  };
  afterSubmit: string;
};

export const contactPageExtras: ContactPageExtras = {
  responseTime: "within 1 business day",
  responseTimeNote:
    "We aim to reply to every inquiry within 1 business day. A message sent outside our working hours is answered at the start of the next business day.",
  types: [
    {
      id: "quote",
      label: "Request a quote",
      description:
        "You have a project in mind and want to know what it would involve and cost. Tell us what you are trying to solve and we will follow up with questions.",
      suggestedInfo: [
        "What you want to build or fix",
        "Who will use it",
        "Any tools you use now",
        "Rough timeline, if you have one",
      ],
    },
    {
      id: "call",
      label: "Book a call",
      description:
        "You would like to talk through an idea or problem before deciding anything. A discovery call is a good place to start.",
      suggestedInfo: [
        "A few lines on what you would like to discuss",
        "Your time zone",
        "Two or three times that suit you",
      ],
    },
    {
      id: "partnership",
      label: "Partnership inquiry",
      description:
        "You run an agency, consultancy, or product team and want to explore working together, for example by adding development capacity.",
      suggestedInfo: [
        "A little about your company",
        "The kind of work you would like help with",
        "How you prefer to collaborate",
      ],
    },
  ],
  formLabels: {
    name: "Your name",
    email: "Email address",
    company: "Company (optional)",
    type: "What can we help with?",
    message: "Tell us a little about what you need",
    submit: "Send message",
  },
  afterSubmit:
    "Thanks for getting in touch. We will reply within 1 business day.",
};

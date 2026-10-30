/**
 * Delvix Studio — typed mega-menu navigation (single source of truth for the header).
 *
 * Icons are lucide-react names stored as string literals so this file stays
 * server/client agnostic. The header maps them to components (see site-header.tsx).
 * Link descriptions are capped at 60 characters.
 */

/** Every lucide-react icon name used in the navigation. Add here before using. */
export type LucideIconName =
  | "Layers"
  | "FileCheck"
  | "UserCheck"
  | "RefreshCw"
  | "LifeBuoy"
  | "Compass"
  | "Globe"
  | "Smartphone"
  | "Boxes"
  | "Users"
  | "Cloud"
  | "Workflow"
  | "MonitorSmartphone"
  | "Rocket"
  | "Search"
  | "Wrench"
  | "Sparkles"
  | "Code2"
  | "Building2"
  | "FolderKanban"
  | "Info"
  | "Bot"
  | "FileText"
  | "MessageSquare"
  | "TrendingUp"
  | "Plug"
  | "Atom"
  | "Server"
  | "Terminal"
  | "Braces"
  | "Database"
  | "CloudCog"
  | "BrainCircuit"
  | "Cpu"
  | "Gauge"
  | "Truck"
  | "Home"
  | "Stethoscope"
  | "HardHat"
  | "ShoppingCart"
  | "Briefcase"
  | "GraduationCap"
  | "Lightbulb"
  | "BookOpen"
  | "ShieldCheck"
  | "Mail"
  | "Tag"
  | "Handshake"
  | "Circle";

export type NavLink = {
  href: string;
  title: string;
  /** Max 60 characters */
  description: string;
  icon: LucideIconName;
};

export type NavSection = {
  heading: string;
  links: NavLink[];
};

export type NavHighlight = {
  title: string;
  body: string;
  ctaLabel: string;
  href: string;
  /** Illustration under /public/marketing/illustrations */
  imageSrc?: string;
  imageAlt?: string;
};

export type NavTop = {
  /** Stable id, also used for aria ids */
  id: string;
  label: string;
  icon: LucideIconName;
  /** Present only for top items that link directly (no dropdown) */
  href?: string;
  sections?: NavSection[];
  highlight?: NavHighlight;
};

export const mainNav: NavTop[] = [
  {
    id: "services",
    label: "Services",
    icon: "Layers",
    sections: [
      {
        heading: "How we work",
        links: [
          {
            href: "/services/fixed-price-projects",
            title: "Fixed-price projects",
            description: "Agreed scope, agreed price, weekly demos",
            icon: "FileCheck",
          },
          {
            href: "/services/dedicated-developers",
            title: "Dedicated developers",
            description: "Engineers embedded in your team",
            icon: "UserCheck",
          },
          {
            href: "/services/product-retainer",
            title: "Monthly product retainer",
            description: "Ongoing build capacity, month to month",
            icon: "RefreshCw",
          },
          {
            href: "/services/project-rescue",
            title: "Project rescue",
            description: "Take over a stalled or troubled build",
            icon: "LifeBuoy",
          },
          {
            href: "/services/technical-consulting",
            title: "Technical consulting / virtual CTO",
            description: "Architecture and hiring guidance on call",
            icon: "Compass",
          },
        ],
      },
      {
        heading: "What we build",
        links: [
          {
            href: "/services/web-applications",
            title: "Custom web applications",
            description: "Portals, dashboards and internal tools",
            icon: "Globe",
          },
          {
            href: "/services/mobile-apps",
            title: "Mobile apps (iOS & Android)",
            description: "One codebase, both app stores",
            icon: "Smartphone",
          },
          {
            href: "/services/erp-development",
            title: "Custom ERP systems",
            description: "Operations software shaped to your workflow",
            icon: "Boxes",
          },
          {
            href: "/services/crm-development",
            title: "Custom CRM systems",
            description: "Pipelines and customer records that fit you",
            icon: "Users",
          },
          {
            href: "/services/saas-development",
            title: "SaaS product development",
            description: "Multi-tenant products, billing and auth",
            icon: "Cloud",
          },
          {
            href: "/services/automation-integrations",
            title: "Automation & integrations",
            description: "Connect your tools, remove manual steps",
            icon: "Workflow",
          },
          {
            href: "/services/website-development",
            title: "Website design & development",
            description: "Fast, clear sites that support sales",
            icon: "MonitorSmartphone",
          },
        ],
      },
      {
        heading: "By stage",
        links: [
          {
            href: "/services/mvp-development",
            title: "MVP development",
            description: "Get a first version in front of users",
            icon: "Rocket",
          },
          {
            href: "/services/discovery",
            title: "Discovery & scoping",
            description: "Define what to build before you commit",
            icon: "Search",
          },
          {
            href: "/services/legacy-modernization",
            title: "Modernize legacy systems",
            description: "Upgrade old software without a big-bang rewrite",
            icon: "Wrench",
          },
        ],
      },
    ],
    highlight: {
      title: "Find what's costing you customers",
      body: "A short report with screenshots: what's broken and what to fix first.",
      ctaLabel: "Get my free audit",
      href: "/free-audit",
      imageSrc: "/marketing/menu-01.webp",
      imageAlt: "Sample audit report",
    },
  },
  {
    id: "ai",
    label: "AI",
    icon: "Sparkles",
    sections: [
      {
        heading: "AI services",
        links: [
          {
            href: "/ai/ai-integrations",
            title: "AI integrations",
            description: "Add AI features to software you already run",
            icon: "Plug",
          },
          {
            href: "/ai/ai-agents",
            title: "AI agents",
            description: "Task-focused agents with clear guardrails",
            icon: "Bot",
          },
          {
            href: "/ai/document-processing",
            title: "Document processing",
            description: "Extract and route data from files and forms",
            icon: "FileText",
          },
          {
            href: "/ai/chatbots",
            title: "Chatbots",
            description: "Support and lead chat grounded in your content",
            icon: "MessageSquare",
          },
          {
            href: "/ai/sales-automation",
            title: "Sales automation",
            description: "Automate follow-ups and pipeline admin",
            icon: "TrendingUp",
          },
        ],
      },
      {
        heading: "Our AI product",
        links: [
          {
            href: "/autopilot",
            title: "Autopilot",
            description: "Our outbound sales platform",
            icon: "Rocket",
          },
          {
            href: "/work/revenue-os",
            title: "How we built Revenue OS",
            description: "Behind-the-scenes of our own platform",
            icon: "BookOpen",
          },
        ],
      },
      {
        heading: "Free tools",
        links: [
          {
            href: "/free-audit",
            title: "Free website audit",
            description: "A written review of your site's basics",
            icon: "Search",
          },
        ],
      },
    ],
    highlight: {
      title: "AI that works on your data",
      body: "Start with one real workflow in your business and we will scope an AI feature around it.",
      ctaLabel: "Explore AI integrations",
      href: "/ai/ai-integrations",
      imageSrc: "/marketing/illustrations/ai-workspace.svg",
      imageAlt: "AI workspace preview",
    },
  },
  {
    id: "technologies",
    label: "Technologies",
    icon: "Code2",
    sections: [
      {
        heading: "Frontend",
        links: [
          {
            href: "/technologies/nextjs",
            title: "Next.js",
            description: "Fast, SEO-friendly web apps and sites",
            icon: "Globe",
          },
          {
            href: "/technologies/react",
            title: "React",
            description: "Component-based interfaces that scale",
            icon: "Atom",
          },
        ],
      },
      {
        heading: "Backend",
        links: [
          {
            href: "/technologies/nodejs",
            title: "Node.js",
            description: "APIs and real-time services in TypeScript",
            icon: "Server",
          },
          {
            href: "/technologies/laravel",
            title: "Laravel",
            description: "Mature PHP framework for business apps",
            icon: "Braces",
          },
          {
            href: "/technologies/python",
            title: "Python",
            description: "Automation, data work and AI pipelines",
            icon: "Terminal",
          },
        ],
      },
      {
        heading: "Mobile",
        links: [
          {
            href: "/technologies/react-native",
            title: "React Native",
            description: "Native-feel apps from a JavaScript codebase",
            icon: "Smartphone",
          },
          {
            href: "/technologies/flutter",
            title: "Flutter",
            description: "Cross-platform apps with a custom UI",
            icon: "Layers",
          },
        ],
      },
      {
        heading: "Data & cloud",
        links: [
          {
            href: "/technologies/postgresql",
            title: "PostgreSQL",
            description: "Reliable relational data for core systems",
            icon: "Database",
          },
          {
            href: "/technologies/aws",
            title: "AWS",
            description: "Hosting, storage and deployment pipelines",
            icon: "CloudCog",
          },
        ],
      },
      {
        heading: "AI platforms",
        links: [
          {
            href: "/technologies/openai",
            title: "OpenAI",
            description: "GPT models inside your product workflows",
            icon: "BrainCircuit",
          },
          {
            href: "/technologies/anthropic",
            title: "Anthropic",
            description: "Claude models for analysis and drafting",
            icon: "Cpu",
          },
        ],
      },
    ],
    highlight: {
      title: "The right stack, not our favorite",
      body: "We pick tools to match your team and roadmap. See what we work with day to day.",
      ctaLabel: "See all technologies",
      href: "/technologies",
      imageSrc: "/marketing/illustrations/code-stack.svg",
      imageAlt: "Technology stack overview",
    },
  },
  {
    id: "industries",
    label: "Industries",
    icon: "Building2",
    sections: [
      {
        heading: "Industries we serve",
        links: [
          {
            href: "/industries/logistics-trucking",
            title: "Logistics & trucking",
            description: "Dispatch, tracking and driver workflows",
            icon: "Truck",
          },
          {
            href: "/industries/real-estate",
            title: "Real estate",
            description: "Listings, leads and property operations",
            icon: "Home",
          },
          {
            href: "/industries/healthcare-clinics",
            title: "Healthcare & clinics",
            description: "Scheduling, intake and patient follow-up",
            icon: "Stethoscope",
          },
          {
            href: "/industries/construction-trades",
            title: "Construction & trades",
            description: "Jobs, quotes and field-team coordination",
            icon: "HardHat",
          },
          {
            href: "/industries/retail-inventory",
            title: "Retail & inventory",
            description: "Stock, orders and multi-channel selling",
            icon: "ShoppingCart",
          },
          {
            href: "/industries/professional-services",
            title: "Professional services",
            description: "Client portals, billing and time tracking",
            icon: "Briefcase",
          },
          {
            href: "/industries/education",
            title: "Education",
            description: "Learning platforms and admin tooling",
            icon: "GraduationCap",
          },
          {
            href: "/industries/startups-saas",
            title: "Startups & SaaS",
            description: "From first version to paying customers",
            icon: "Lightbulb",
          },
        ],
      },
    ],
    highlight: {
      title: "Not on the list?",
      body: "Most of our work is operational software. Tell us how your business runs and we will say if we are a fit.",
      ctaLabel: "Talk to us",
      href: "/contact",
      imageSrc: "/marketing/illustrations/dispatch-board.svg",
      imageAlt: "Operations board for industry workflows",
    },
  },
  {
    id: "work",
    label: "Work",
    icon: "FolderKanban",
    href: "/work",
  },
  {
    id: "company",
    label: "Company",
    icon: "Info",
    sections: [
      {
        heading: "Company",
        links: [
          {
            href: "/about",
            title: "About",
            description: "Who we are and how the studio operates",
            icon: "Info",
          },
          {
            href: "/process",
            title: "How we work",
            description: "From discovery call to launch and support",
            icon: "Workflow",
          },
          {
            href: "/pricing",
            title: "Pricing",
            description: "Engagement models and what drives cost",
            icon: "Tag",
          },
          {
            href: "/security",
            title: "Security",
            description: "How we handle access, code and data",
            icon: "ShieldCheck",
          },
          {
            href: "/careers",
            title: "Careers",
            description: "Open roles and how we hire",
            icon: "Users",
          },
          {
            href: "/contact",
            title: "Contact",
            description: "Book a call or send us a brief",
            icon: "Mail",
          },
        ],
      },
    ],
    highlight: {
      title: "Talk to an engineer first",
      body: "Prefer a straight conversation over a sales pitch? Send a brief and we will reply with next steps.",
      ctaLabel: "Contact us",
      href: "/contact",
      imageSrc: "/marketing/illustrations/studio-team.svg",
      imageAlt: "Studio collaboration workspace",
    },
  },
];

/**
 * Header CTAs. Booking URL is inlined (same value as siteConfig.contact.bookingUrl)
 * to avoid circular import init races that can hydrate-mismatch the header.
 */
export const headerCtas = {
  secondary: { label: "Get a quote", href: "/contact?type=quote" },
  primary: {
    label: "Book a free call",
    href: "https://cal.com/delvix/intro",
  },
};

/** Every unique href in the menu (top items, links, highlights, CTAs). For the crawl script. */
export function getAllNavHrefs(): string[] {
  const hrefs = new Set<string>();
  for (const top of mainNav) {
    if (top.href) hrefs.add(top.href);
    for (const section of top.sections ?? []) {
      for (const link of section.links) hrefs.add(link.href);
    }
    if (top.highlight) hrefs.add(top.highlight.href);
  }
  hrefs.add(headerCtas.secondary.href);
  hrefs.add(headerCtas.primary.href);
  return [...hrefs];
}

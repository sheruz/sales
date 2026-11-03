import Link from "next/link";
import { SiteLogo } from "@/components/marketing/site-logo";
import { PathIcon } from "@/components/marketing/path-icon";
import { siteConfig } from "@/content/site";

const cols = [
  {
    title: "Services",
    links: [
      { label: "Web applications", href: "/services/web-applications" },
      { label: "Mobile apps", href: "/services/mobile-apps" },
      { label: "Custom ERP", href: "/services/erp-development" },
      { label: "Custom CRM", href: "/services/crm-development" },
      { label: "SaaS platforms", href: "/services/saas-development" },
      { label: "Project rescue", href: "/services/project-rescue" },
    ],
  },
  {
    title: "AI",
    links: [
      { label: "AI integrations", href: "/ai/ai-integrations" },
      { label: "AI agents", href: "/ai/ai-agents" },
      { label: "Document processing", href: "/ai/document-processing" },
      { label: "Chatbots", href: "/ai/chatbots" },
      { label: "Delvix Autopilot", href: "/autopilot" },
    ],
  },
  {
    title: "Industries",
    links: [
      { label: "Logistics & trucking", href: "/industries/logistics-trucking" },
      { label: "Real estate", href: "/industries/real-estate" },
      { label: "Clinics", href: "/industries/healthcare-clinics" },
      { label: "Construction", href: "/industries/construction-trades" },
      { label: "Retail", href: "/industries/retail-inventory" },
      { label: "All industries", href: "/industries" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "How we work", href: "/process" },
      { label: "Work", href: "/work" },
      { label: "Pricing", href: "/pricing" },
      { label: "Security", href: "/security" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Cookies", href: "/cookies" },
    ],
  },
] as const;

const socials = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/",
    icon: "M4 9h4v11H4zM6 4a2 2 0 1 0 0 4a2 2 0 0 0 0-4zM10 9h4v1.5c.6-1 2-1.8 3.5-1.8 2.6 0 3.5 1.7 3.5 4.3V20h-4v-6c0-1.2-.4-2-1.6-2s-1.4 1-1.4 2v6h-4z",
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/",
    icon: "M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zM12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8zM17.5 6.5h.01",
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/",
    icon: "M15 3h-2a4 4 0 0 0-4 4v3H7v4h2v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h2z",
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-[#1E2738] bg-[#080E1A] text-[#A3ADC2]">
      <div className="mkt-wrap flex flex-col gap-12 px-6 pb-8 pt-[72px]">
        <div className="flex flex-wrap gap-12">
          <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-4">
            <SiteLogo height={36} />
            <p className="m-0 max-w-[320px] text-[15px] leading-[1.65]">
              A remote software studio building web apps, mobile apps, ERP, CRM and AI automation for
              growing businesses.
            </p>
            <div className="flex flex-col gap-2 text-[15px]">
              <a
                href={`mailto:${siteConfig.contact.email}`}
                className="text-[#D5DBE8] no-underline hover:text-white"
              >
                {siteConfig.contact.email}
              </a>
              <a
                href={siteConfig.contact.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#D5DBE8] no-underline hover:text-white"
                aria-label="Chat on WhatsApp"
              >
                {siteConfig.contact.phoneDisplay}
              </a>
            </div>
            <div className="flex gap-2.5">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="flex size-10 items-center justify-center rounded-[10px] border border-[#1E2738] text-[#D5DBE8] hover:border-[#2A3550] hover:text-white"
                >
                  <PathIcon d={s.icon} size={18} />
                </a>
              ))}
            </div>
          </div>

          <div className="grid min-w-0 flex-[3_1_600px] grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
            {cols.map((c) => (
              <div key={c.title} className="flex flex-col gap-3">
                <strong className="text-sm font-semibold uppercase tracking-[0.06em] text-[#F5F7FB]">
                  {c.title}
                </strong>
                {c.links.map((l) => (
                  <Link
                    key={l.href + l.label}
                    href={l.href}
                    className="text-[15px] text-[#A3ADC2] no-underline hover:text-[#F5F7FB]"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#1E2738] pt-6 text-sm">
          <span>© 2026 Delvix Studio. All rights reserved.</span>
          <span>Working with clients in the US, UK, Europe and the Gulf.</span>
        </div>
      </div>
    </footer>
  );
}

import Link from "next/link";
import { SiteLogo } from "@/components/marketing/site-logo";
import { getMainNav, siteConfig } from "@/content/site";
import { industryPages } from "@/content/pages";
import { serviceCardTitle } from "@/lib/marketing/card-titles";

const footerServiceSlugs = [
  "web-applications",
  "mobile-apps",
  "erp-development",
  "crm-development",
  "saas-development",
  "project-rescue",
] as const;

const footerAISlugs = [
  "ai-integrations",
  "ai-agents",
  "document-processing",
  "chatbots",
] as const;

export function SiteFooter() {
  const company =
    getMainNav().find((n) => n.label === "Company")?.children ?? [];

  return (
    <footer className="mkt-footer">
      <div className="mkt-wrap grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-3 sm:col-span-2 lg:col-span-1">
          <SiteLogo height={36} />
          <p className="max-w-xs text-sm leading-relaxed">
            A remote software studio building web apps, mobile apps, ERP, CRM and AI automation for growing businesses.
          </p>
          <div className="space-y-1 text-sm">
            <a href={`mailto:${siteConfig.contact.email}`} className="block">
              {siteConfig.contact.email}
            </a>
            <a href={`tel:${siteConfig.contact.phone}`} className="block">
              {siteConfig.contact.phoneDisplay}
            </a>
            {siteConfig.contact.whatsapp ? (
              <a href={siteConfig.contact.whatsapp} className="block">
                WhatsApp
              </a>
            ) : null}
          </div>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold text-[var(--mkt-ink)]">
            Services
          </p>
          <ul className="m-0 list-none space-y-2 p-0 text-sm">
            {footerServiceSlugs.map((slug) => (
              <li key={slug}>
                <Link href={`/services/${slug}`}>{serviceCardTitle(slug)}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold text-[var(--mkt-ink)]">
            AI
          </p>
          <ul className="m-0 list-none space-y-2 p-0 text-sm">
            {footerAISlugs.map((slug) => (
              <li key={slug}>
                <Link href={`/ai/${slug}`}>{serviceCardTitle(slug)}</Link>
              </li>
            ))}
            <li>
              <Link href="/autopilot">Delvix Autopilot</Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold text-[var(--mkt-ink)]">
            Industries
          </p>
          <ul className="m-0 list-none space-y-2 p-0 text-sm">
            {industryPages.slice(0, 5).map((i) => (
              <li key={i.slug}>
                <Link href={`/industries/${i.slug}`}>{i.name}</Link>
              </li>
            ))}
            <li>
              <Link href="/industries">All industries</Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold text-[var(--mkt-ink)]">
            Company
          </p>
          <ul className="m-0 list-none space-y-2 p-0 text-sm">
            <li>
              <Link href="/about">About</Link>
            </li>
            <li>
              <Link href="/process">How we work</Link>
            </li>
            <li>
              <Link href="/work">Work</Link>
            </li>
            <li>
              <Link href="/pricing">Pricing</Link>
            </li>
            <li>
              <Link href="/security">Security</Link>
            </li>
            <li>
              <Link href="/contact">Contact</Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold text-[var(--mkt-ink)]">
            Legal
          </p>
          <ul className="m-0 list-none space-y-2 p-0 text-sm">
            <li>
              <Link href="/privacy">Privacy</Link>
            </li>
            <li>
              <Link href="/terms">Terms</Link>
            </li>
            <li>
              <Link href="/cookies">Cookies</Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="mkt-wrap mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--mkt-line)] pt-6 text-xs">
        <p>
          © {new Date().getFullYear()} {siteConfig.legalName}. All rights reserved.
        </p>
        <p className="text-muted-foreground">
          Working with clients in the US, UK, Europe and the Gulf.
        </p>
      </div>
    </footer>
  );
}

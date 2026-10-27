import Link from "next/link";
import { industries, services, siteConfig } from "@/content/site";

export function SiteFooter() {
  return (
    <footer className="mkt-footer">
      <div className="mkt-wrap grid gap-10 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <div className="space-y-3">
          <p className="text-lg font-semibold text-[var(--mkt-ink)]">
            {siteConfig.name}
          </p>
          <p className="max-w-sm text-sm leading-relaxed">
            {siteConfig.tagline} Fixed scope, weekly demos, and you own the code.
          </p>
          <div className="space-y-1 text-sm">
            <a href={`mailto:${siteConfig.contact.email}`} className="block">
              {siteConfig.contact.email}
            </a>
            <a href={`tel:${siteConfig.contact.phone}`} className="block">
              {siteConfig.contact.phoneDisplay}
            </a>
            <a
              href={siteConfig.contact.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              WhatsApp
            </a>
          </div>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold text-[var(--mkt-ink)]">
            Services
          </p>
          <ul className="space-y-2 text-sm">
            {services.map((s) => (
              <li key={s.slug}>
                <Link href={`/services/${s.slug}`}>{s.name}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold text-[var(--mkt-ink)]">
            Industries
          </p>
          <ul className="space-y-2 text-sm">
            {industries.map((i) => (
              <li key={i.slug}>
                <Link href={`/industries/${i.slug}`}>{i.name}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-6">
          <div>
            <p className="mb-3 text-sm font-semibold text-[var(--mkt-ink)]">
              Company
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/about">About</Link>
              </li>
              <li>
                <Link href="/work">Work</Link>
              </li>
              <li>
                <Link href="/pricing">Pricing</Link>
              </li>
              <li>
                <Link href="/autopilot">Autopilot</Link>
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
            <ul className="space-y-2 text-sm">
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
      </div>
      <div className="mkt-wrap mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--mkt-line)] pt-6 text-xs">
        <p>© {new Date().getFullYear()} {siteConfig.legalName}</p>
        {siteConfig.socials.length > 0 ? (
          <div className="flex gap-4">
            {siteConfig.socials.map((s) => (
              <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer">
                {s.label}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </footer>
  );
}

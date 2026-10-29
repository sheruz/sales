import Link from "next/link";
import type { Metadata } from "next";
import { ContactForm } from "@/components/marketing/contact-form";
import { PageBreadcrumb } from "@/components/marketing/page-breadcrumb";
import { PageVisual } from "@/components/marketing/page-visual";
import { RelatedPages } from "@/components/marketing/related-pages";
import { SectionCta } from "@/components/marketing/section-cta";
import { contactPageExtras } from "@/content/pages";
import { siteConfig } from "@/content/site";
import { buildPageMetadata } from "@/lib/marketing/page-metadata";
import { visualForPath } from "@/lib/marketing/page-visuals";

export const metadata: Metadata = buildPageMetadata({
  title: "Contact Delvix Studio | Book a Call or Send a Brief",
  description:
    "Book a free call, message us on WhatsApp, email, or send a short project brief. Delvix Studio replies within one business day.",
  path: "/contact",
});

export default function ContactPage() {
  const { email, phone, phoneDisplay, whatsapp, bookingUrl } = siteConfig.contact;
  const extras = contactPageExtras;

  return (
    <>
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap grid gap-12 lg:grid-cols-2">
          <div className="space-y-6">
            <PageBreadcrumb current="Contact" currentPath="/contact" />
            <div className="space-y-3">
              <p className="mkt-eyebrow">Contact</p>
              <h1 className="text-4xl font-extrabold sm:text-5xl">
                Tell us what you&apos;re running on
              </h1>
              <p className="mkt-muted text-lg">
                Prefer a call, chat or a short written brief? All fine. We reply{" "}
                {extras.responseTime}.
              </p>
              <p className="mkt-muted text-sm leading-relaxed">
                {extras.responseTimeNote}
              </p>
            </div>
            <ul className="m-0 list-none space-y-3 p-0 text-sm">
              <li>
                <a className="mkt-link" href={`mailto:${email}`}>
                  {email}
                </a>
              </li>
              <li>
                <a className="mkt-link" href={`tel:${phone}`}>
                  {phoneDisplay}
                </a>
              </li>
              <li>
                <a
                  className="mkt-link"
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp
                </a>
              </li>
            </ul>
            <div className="flex flex-wrap gap-3">
              <Link
                href={bookingUrl}
                className="mkt-btn mkt-btn--primary"
                data-mkt-schedule
              >
                Book a free call
              </Link>
              <Link href="/free-audit" className="mkt-btn mkt-btn--secondary">
                Get a free audit
              </Link>
            </div>
          </div>
          <div className="space-y-3">
            <ContactForm />
            <p className="mkt-muted text-xs leading-relaxed">{extras.afterSubmit}</p>
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap space-y-8">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1fr]">
            <div className="max-w-2xl space-y-3">
              <p className="mkt-eyebrow">How can we help?</p>
              <h2 className="text-3xl font-extrabold">Pick the kind of message</h2>
              <p className="mkt-muted leading-relaxed">
                A little context up front means a more useful first reply.
              </p>
            </div>
            <PageVisual visual={visualForPath("/contact")} alt="Contact Delvix Studio" />
          </div>
          <div className="mkt-grid-3">
            {extras.types.map((t) => (
              <div key={t.id} id={t.id} className="mkt-card">
                <h3 className="mb-2 text-lg font-bold">{t.label}</h3>
                <p className="mkt-muted mb-3 text-sm leading-relaxed">
                  {t.description}
                </p>
                <p className="mb-1 text-sm font-semibold">Helpful to include:</p>
                <ul className="m-0 list-disc space-y-1 pl-5 text-sm">
                  {t.suggestedInfo.map((info) => (
                    <li key={info}>{info}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RelatedPages
        tone="dark"
        links={[
          { href: "/pricing", label: "Pricing and engagement models" },
          { href: "/process", label: "How we work" },
          { href: "/free-audit", label: "Get a free website audit" },
        ]}
      />
      <SectionCta
        title="Rather speak to someone now?"
        sub="Book a free call and pick a time that suits you."
      />
    </>
  );
}

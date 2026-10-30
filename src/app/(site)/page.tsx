import Link from "next/link";
import type { Metadata } from "next";
import { AuditForm } from "@/components/marketing/audit-form";
import { MarketingCard } from "@/components/marketing/marketing-card";
import { ProductShot } from "@/components/marketing/product-shot";
import { SectionHeader } from "@/components/marketing/section-header";
import {
  engagementModels,
  faq,
  featuredCaseStudy,
  processSteps,
  siteConfig,
  solutions,
  techStack,
  valueTags,
  verifiedCaseStudies,
  whyDelvixRows,
} from "@/content/site";
import { industryPages, servicePages } from "@/content/pages";
import { serviceCardTitle } from "@/lib/marketing/card-titles";
import {
  visualForIndustry,
  visualForService,
} from "@/lib/marketing/page-visuals";

const homeServices = [
  "web-applications",
  "mobile-apps",
  "erp-development",
  "crm-development",
  "saas-development",
  "automation-integrations",
]
  .map((slug) => servicePages.find((s) => s.slug === slug))
  .filter(Boolean) as typeof servicePages;

const homeIndustries = industryPages.slice(0, 8);

const techGroups = Object.entries(techStack).map(([group, items]) => ({
  group,
  items,
}));

export const metadata: Metadata = {
  title: `${siteConfig.name} — Custom software for growing businesses`,
  description:
    "We build web apps, mobile apps, custom ERP/CRM, AI integrations and automation. Fixed scope, weekly demos, you own the code.",
  alternates: { canonical: siteConfig.url },
};

function JsonLd() {
  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    email: siteConfig.contact.email,
    telephone: siteConfig.contact.phone,
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(org) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
    </>
  );
}

export default function MarketingHomePage() {
  const featured = featuredCaseStudy();
  const cases = verifiedCaseStudies();

  return (
    <>
      <JsonLd />

      {/* Hero */}
      <section className="mkt-section mkt-section--dark relative overflow-hidden">
        <div className="mkt-glow left-1/2 top-0 -translate-x-1/2" aria-hidden />
        <div className="mkt-wrap relative z-[1] mkt-split">
          <div className="mkt-fade space-y-6">
            <p className="mkt-eyebrow">Software house</p>
            <h1 className="max-w-[16ch] text-4xl font-extrabold text-balance sm:text-5xl lg:text-6xl">
              We build the systems behind growing businesses
            </h1>
            <p className="mkt-muted max-w-[42ch] text-lg">
              Web apps, mobile, ERP/CRM, AI and automation — scoped in writing,
              demoed weekly, handed over as yours.
            </p>
            <ul className="flex flex-wrap gap-2">
              {valueTags.map((t) => (
                <li key={t} className="mkt-badge">
                  {t}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link
                href={siteConfig.contact.bookingUrl}
                className="mkt-btn mkt-btn--primary"
                data-mkt-schedule
              >
                Book a free call
              </Link>
              <Link href="/work" className="mkt-btn mkt-btn--secondary">
                See our work
              </Link>
            </div>
          </div>
          <ProductShot
            name="revenue-os-dashboard"
            alt="Revenue OS product dashboard"
            priority
            hero
            className="mkt-fade"
          />
        </div>
      </section>

      {/* Services */}
      <section className="mkt-section mkt-section--light" id="services">
        <div className="mkt-wrap space-y-8">
          <SectionHeader
            eyebrow="Services"
            title="What we build"
            lead="Six focused lines. Each engagement starts with a written scope."
            action={{ href: "/services", label: "All services →" }}
          />
          <div className="mkt-grid-3">
            {homeServices.map((s) => (
              <MarketingCard
                key={s.slug}
                href={`/services/${s.slug}`}
                title={serviceCardTitle(s.slug)}
                description={s.subline}
                visual={visualForService(s.slug)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Free audit */}
      <section className="mkt-section mkt-section--dark" id="audit">
        <div className="mkt-wrap mkt-split">
          <div className="space-y-5">
            <p className="mkt-eyebrow">Offer</p>
            <h2 className="text-4xl font-extrabold text-balance lg:text-5xl">
              Free website &amp; systems audit
            </h2>
            <p className="mkt-muted text-lg max-w-xl">
              Tell us what you are running on. We reply with a short written
              read of the gaps — no pitch deck.
            </p>
            <div>
              <p className="mb-2 text-sm font-semibold">What we check</p>
              <ul className="m-0 list-none space-y-2 p-0 text-sm">
                {[
                  "Speed and Core Web Vitals basics",
                  "Forms, mobile layout and SSL",
                  "Broken pages and obvious SEO gaps",
                ].map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="text-[var(--mkt-accent)]" aria-hidden>
                      ✓
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <AuditForm />
        </div>
      </section>

      {/* Process */}
      <section className="mkt-section mkt-section--light" id="process">
        <div className="mkt-wrap space-y-8">
          <SectionHeader
            eyebrow="How we work"
            title="From call to launch"
            lead="Six clear steps. You always know what comes next."
            action={{ href: "/process", label: "Full process →" }}
          />
          <ol className="mkt-grid-3 list-none p-0">
            {processSteps.map((step) => (
              <li key={step.n} className="mkt-card flex h-full flex-col">
                <p className="mkt-step-num mb-3">{step.n}</p>
                <h3 className="mb-2 text-xl font-semibold text-balance">
                  {step.title}
                </h3>
                <p className="mkt-muted text-sm leading-relaxed">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* How we can work together (merged engagement + solutions chips) */}
      <section className="mkt-section mkt-section--dark" id="engagement">
        <div className="mkt-wrap space-y-8">
          <SectionHeader
            eyebrow="Engagement"
            title="How we can work together"
            lead="Pick the shape that fits your deadline and capacity. Solutions like MVP or SaaS sit on top of these models."
            action={{ href: "/pricing", label: "See pricing →" }}
          />
          <div className="mkt-grid-3">
            {engagementModels.map((m) => (
              <div key={m.name} className="mkt-card flex h-full flex-col">
                <h3 className="mb-2 text-xl font-semibold text-balance">
                  {m.name}
                </h3>
                <p className="mkt-muted mb-4 text-sm">Fits: {m.fits}</p>
                <ul className="mb-5 space-y-2 text-sm">
                  {m.includes.map((line) => (
                    <li key={line}>· {line}</li>
                  ))}
                </ul>
                <Link href="/pricing" className="mkt-link mt-auto text-sm">
                  Get pricing →
                </Link>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="mkt-muted text-sm">Also exploring:</span>
            {solutions.map((s) => (
              <Link key={s.slug} href={`/solutions/${s.slug}`} className="mkt-badge">
                {s.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Why Delvix */}
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <SectionHeader
            eyebrow="Why Delvix"
            title="Clearer than a typical agency"
            lead="Written scope, weekly demos and code you own — without the account-manager maze."
          />
          <div className="mkt-compare" role="table" aria-label="Delvix vs typical agency">
            <div
              className="mkt-compare__row hidden md:grid"
              role="row"
              style={{
                background: "transparent",
                border: "none",
                paddingBottom: 0,
              }}
            >
              <div role="columnheader" className="text-sm font-semibold opacity-70">
                Topic
              </div>
              <div role="columnheader" className="text-sm font-semibold text-[var(--mkt-accent)]">
                Delvix
              </div>
              <div role="columnheader" className="mkt-muted text-sm font-semibold">
                Typical agency
              </div>
            </div>
            {whyDelvixRows.map((row) => (
              <div key={row.label} className="mkt-compare__row" role="row">
                <div role="rowheader" className="font-semibold">
                  {row.label}
                </div>
                <div className="mkt-compare__delvix" role="cell">
                  <span className="mr-2 text-[var(--mkt-accent)]" aria-hidden>
                    ✓
                  </span>
                  {row.delvix}
                </div>
                <div className="mkt-compare__typical" role="cell">
                  <span className="mr-2 opacity-60" aria-hidden>
                    −
                  </span>
                  {row.typical}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Industries — 4×2 */}
      <section className="mkt-section mkt-section--light" id="industries">
        <div className="mkt-wrap space-y-8">
          <SectionHeader
            eyebrow="Industries"
            title="Built for operational businesses"
            lead="Software shaped by how your industry actually works."
            action={{ href: "/industries", label: "All industries →" }}
          />
          <div className="mkt-grid-4">
            {homeIndustries.map((i) => (
              <MarketingCard
                key={i.slug}
                href={`/industries/${i.slug}`}
                title={i.name}
                description={i.subline}
                visual={visualForIndustry(i.slug)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Case studies */}
      {cases.length > 0 && featured ? (
        <section className="mkt-section mkt-section--dark" id="work">
          <div className="mkt-wrap space-y-8">
            <SectionHeader
              eyebrow="Work"
              title="Case studies"
              lead="Only verified engagements. No filler logos or invented results."
              action={{ href: "/work", label: "All work →" }}
            />
            <Link
              href={`/work/${featured.slug}`}
              className="mkt-card mkt-card--link mkt-split !items-center"
            >
              <div className="flex h-full flex-col justify-center space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--mkt-accent)]">
                  Featured
                </p>
                <h3 className="text-2xl font-bold text-balance sm:text-3xl">
                  {featured.title}
                </h3>
                <p className="mkt-muted text-sm">{featured.clientType}</p>
                <p className="text-sm leading-relaxed">{featured.problem}</p>
                {featured.platformFeatures?.length ? (
                  <ul className="m-0 list-none space-y-1.5 p-0 text-sm">
                    {featured.platformFeatures.slice(0, 3).map((f) => (
                      <li key={f} className="flex gap-2">
                        <span className="text-[var(--mkt-accent)]" aria-hidden>
                          ✓
                        </span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {featured.stack.slice(0, 6).map((s) => (
                    <span key={s} className="mkt-badge">
                      {s}
                    </span>
                  ))}
                </div>
                {featured.status ? (
                  <p className="mkt-muted text-xs">{featured.status}</p>
                ) : null}
                <span className="mkt-link text-sm">Read case study →</span>
              </div>
              <ProductShot
                name="revenue-os-dashboard"
                alt={featured.title}
              />
            </Link>
          </div>
        </section>
      ) : null}

      {/* Tech stack — group cards, no redundant illustration */}
      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap space-y-8">
          <SectionHeader
            eyebrow="Stack"
            title="Technologies we ship with"
            lead="Mainstream tools you can hire for and host anywhere."
            action={{ href: "/technologies", label: "All technologies →" }}
          />
          <div className="mkt-grid-3">
            {techGroups.map(({ group, items }) => (
              <div key={group} className="mkt-card flex h-full flex-col">
                <h3 className="mb-3 text-lg font-semibold">{group}</h3>
                <div className="mt-auto flex flex-wrap gap-2">
                  {items.map((item) => (
                    <span key={item} className="mkt-badge">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Autopilot */}
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap mkt-card mkt-split !items-center">
          <div className="space-y-4">
            <p className="mkt-eyebrow">Product</p>
            <h2 className="text-3xl font-bold text-balance sm:text-4xl">
              Delvix Autopilot
            </h2>
            <p className="mkt-muted text-lg">
              Our own client-acquisition platform — separate from studio
              services. Early access for agencies.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link href="/autopilot" className="mkt-btn mkt-btn--primary">
                Learn about Autopilot
              </Link>
              <Link
                href="/work/revenue-os"
                className="mkt-btn mkt-btn--secondary"
              >
                How we built it
              </Link>
            </div>
          </div>
          <ProductShot
            name="revenue-os-pipeline"
            alt="Autopilot sales pipeline"
          />
        </div>
      </section>

      {/* FAQ */}
      <section className="mkt-section mkt-section--light" id="faq">
        <div className="mkt-wrap mkt-faq-layout">
          <aside className="mkt-faq-layout__aside space-y-5">
            <div className="space-y-3">
              <p className="mkt-eyebrow">FAQ</p>
              <h2 className="text-4xl font-extrabold text-balance lg:text-5xl">
                Common questions
              </h2>
              <p className="mkt-muted text-lg">
                Straight answers about scope, ownership, timezones and support.
              </p>
            </div>
            <div className="mkt-card space-y-3">
              <p className="font-semibold">Still have a question?</p>
              <p className="mkt-muted text-sm leading-relaxed">
                Book a free call and ask an engineer directly.
              </p>
              <Link
                href={siteConfig.contact.bookingUrl}
                className="mkt-btn mkt-btn--primary inline-flex"
                data-mkt-schedule
              >
                Book a free call
              </Link>
            </div>
          </aside>
          <div className="mkt-faq space-y-3">
            {faq.map((f, i) => (
              <details key={f.q} className="mkt-card" open={i === 0}>
                <summary>
                  <span className="font-semibold">{f.q}</span>
                  <span className="mkt-faq__icon" aria-hidden />
                </summary>
                <p className="mkt-muted mt-3 text-sm leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap max-w-3xl space-y-6 text-center">
          <p className="mkt-eyebrow justify-center">Next step</p>
          <h2 className="text-3xl font-bold text-balance sm:text-5xl">
            Tell us what you&apos;re running on today
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href={siteConfig.contact.bookingUrl}
              className="mkt-btn mkt-btn--primary"
              data-mkt-schedule
            >
              Book a free call
            </Link>
            <a
              href={siteConfig.contact.whatsapp}
              className="mkt-btn mkt-btn--secondary"
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp
            </a>
          </div>
          <ul className="flex flex-wrap justify-center gap-2 pt-2">
            {valueTags.map((t) => (
              <li key={t} className="mkt-badge">
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

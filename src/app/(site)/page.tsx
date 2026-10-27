import Link from "next/link";
import type { Metadata } from "next";
import { BrowserFrame } from "@/components/marketing/browser-frame";
import { AuditForm } from "@/components/marketing/audit-form";
import {
  engagementModels,
  faq,
  featuredCaseStudy,
  industries,
  processSteps,
  services,
  siteConfig,
  techStack,
  testimonials,
  valueTags,
  verifiedCaseStudies,
  whyDelvixRows,
} from "@/content/site";

const stats = siteConfig.stats;

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
  const quotes = testimonials.filter((t) => t.verified);

  return (
    <>
      <JsonLd />

      {/* Hero */}
      <section className="mkt-section mkt-section--dark relative overflow-hidden">
        <div className="mkt-glow left-1/2 top-0 -translate-x-1/2" aria-hidden />
        <div className="mkt-wrap relative z-[1] grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="mkt-fade space-y-6">
            <p className="mkt-eyebrow">Software house</p>
            <h1 className="max-w-[16ch] text-4xl font-extrabold sm:text-5xl lg:text-6xl">
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
          <div className="relative mkt-fade">
            <div className="mkt-glow -right-10 top-10" aria-hidden />
            <BrowserFrame
              src="/marketing/screenshots/revenue-os-dashboard.svg"
              alt="Revenue OS product dashboard placeholder"
            />
          </div>
        </div>
      </section>

      {stats.length > 0 ? (
        <section className="mkt-section mkt-section--dark border-t border-[var(--mkt-line)] py-10">
          <div className="mkt-wrap grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-3xl font-extrabold text-[var(--mkt-accent)]">
                  {s.value}
                </p>
                <p className="mkt-muted mt-1 text-sm">{s.label}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Services */}
      <section className="mkt-section mkt-section--light" id="services">
        <div className="mkt-wrap space-y-8">
          <div className="max-w-2xl space-y-3">
            <p className="mkt-eyebrow">Services</p>
            <h2 className="text-3xl font-bold sm:text-4xl">What we build</h2>
            <p className="mkt-muted text-lg">
              Six focused lines. Each engagement starts with a written scope.
            </p>
          </div>
          <div className="mkt-grid-3">
            {services.map((s) => (
              <Link key={s.slug} href={`/services/${s.slug}`} className="mkt-card block">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--mkt-accent)]">
                  {s.name.split(" ")[0]}
                </p>
                <h3 className="mb-2 text-xl font-bold">{s.name}</h3>
                <p className="mkt-muted mb-4 text-sm leading-relaxed">{s.short}</p>
                <span className="mkt-link text-sm">Learn more →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Free audit */}
      <section className="mkt-section mkt-section--dark" id="audit">
        <div className="mkt-wrap grid gap-10 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="mkt-eyebrow">Offer</p>
            <h2 className="text-3xl font-bold sm:text-4xl">
              Free website &amp; systems audit
            </h2>
            <p className="mkt-muted text-lg">
              Tell us what you are running on. We reply with a short written
              read of the gaps — no pitch deck.
            </p>
          </div>
          <AuditForm />
        </div>
      </section>

      {/* Process */}
      <section className="mkt-section mkt-section--light" id="process">
        <div className="mkt-wrap space-y-8">
          <div className="max-w-2xl space-y-3">
            <p className="mkt-eyebrow">How we work</p>
            <h2 className="text-3xl font-bold sm:text-4xl">From call to launch</h2>
          </div>
          <ol className="mkt-grid-3 list-none p-0">
            {processSteps.map((step) => (
              <li key={step.n} className="mkt-card">
                <p className="mb-3 font-mono text-sm text-[var(--mkt-accent)]">
                  {step.n}
                </p>
                <h3 className="mb-2 text-lg font-bold">{step.title}</h3>
                <p className="mkt-muted text-sm leading-relaxed">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Engagement */}
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <div className="max-w-2xl space-y-3">
            <p className="mkt-eyebrow">Engagement</p>
            <h2 className="text-3xl font-bold sm:text-4xl">How teams hire us</h2>
          </div>
          <div className="mkt-grid-3">
            {engagementModels.map((m) => (
              <div key={m.name} className="mkt-card">
                <h3 className="mb-2 text-xl font-bold">{m.name}</h3>
                <p className="mkt-muted mb-4 text-sm">Fits: {m.fits}</p>
                <ul className="mb-5 space-y-2 text-sm">
                  {m.includes.map((line) => (
                    <li key={line}>· {line}</li>
                  ))}
                </ul>
                <Link href="/pricing" className="mkt-link text-sm">
                  Get pricing →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Delvix */}
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <div className="max-w-2xl space-y-3">
            <p className="mkt-eyebrow">Why Delvix</p>
            <h2 className="text-3xl font-bold sm:text-4xl">
              Clearer than a typical agency
            </h2>
          </div>
          <div className="overflow-x-auto rounded-[var(--mkt-radius)] border border-[var(--mkt-line)]">
            <table className="mkt-table">
              <thead>
                <tr>
                  <th scope="col"> </th>
                  <th scope="col">Delvix</th>
                  <th scope="col">Typical agency</th>
                </tr>
              </thead>
              <tbody>
                {whyDelvixRows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td>{row.delvix}</td>
                    <td className="mkt-muted">{row.typical}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Industries */}
      <section className="mkt-section mkt-section--light" id="industries">
        <div className="mkt-wrap space-y-8">
          <div className="max-w-2xl space-y-3">
            <p className="mkt-eyebrow">Industries</p>
            <h2 className="text-3xl font-bold sm:text-4xl">
              Built for operational businesses
            </h2>
          </div>
          <div className="mkt-grid-3">
            {industries.map((i) => (
              <Link key={i.slug} href={`/industries/${i.slug}`} className="mkt-card block">
                <h3 className="mb-2 text-lg font-bold">{i.name}</h3>
                <p className="mkt-muted mb-4 text-sm">{i.short}</p>
                <span className="mkt-link text-sm">Learn more →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Case studies — only if verified */}
      {cases.length > 0 ? (
        <section className="mkt-section mkt-section--dark" id="work">
          <div className="mkt-wrap space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl space-y-3">
                <p className="mkt-eyebrow">Work</p>
                <h2 className="text-3xl font-bold sm:text-4xl">Case studies</h2>
              </div>
              <Link href="/work" className="mkt-link">
                All work →
              </Link>
            </div>
            {featured ? (
              <Link
                href={`/work/${featured.slug}`}
                className="mkt-card grid gap-6 lg:grid-cols-2"
              >
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--mkt-accent)]">
                    Featured
                  </p>
                  <h3 className="mb-2 text-2xl font-bold">{featured.title}</h3>
                  <p className="mkt-muted mb-3 text-sm">{featured.clientType}</p>
                  <p className="mb-4 text-sm leading-relaxed">{featured.problem}</p>
                  <span className="mkt-link text-sm">Read case study →</span>
                </div>
                <BrowserFrame
                  src={featured.screenshots[0]?.src || "/marketing/screenshots/revenue-os-dashboard.svg"}
                  alt={featured.screenshots[0]?.alt || featured.title}
                />
              </Link>
            ) : null}
            {cases.filter((c) => !c.featured).length > 0 ? (
              <div className="mkt-grid-2">
                {cases
                  .filter((c) => !c.featured)
                  .map((c) => (
                    <Link key={c.slug} href={`/work/${c.slug}`} className="mkt-card block">
                      <h3 className="mb-2 text-xl font-bold">{c.title}</h3>
                      <p className="mkt-muted mb-3 text-sm">{c.clientType}</p>
                      <span className="mkt-link text-sm">View →</span>
                    </Link>
                  ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Testimonials — only verified */}
      {quotes.length > 0 ? (
        <section className="mkt-section mkt-section--light">
          <div className="mkt-wrap space-y-8">
            <div className="max-w-2xl space-y-3">
              <p className="mkt-eyebrow">Testimonials</p>
              <h2 className="text-3xl font-bold sm:text-4xl">What clients say</h2>
            </div>
            <div className="mkt-grid-2">
              {quotes.map((t) => (
                <blockquote key={t.name + t.quote.slice(0, 24)} className="mkt-card">
                  <p className="mb-4 text-sm leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                  <footer className="text-sm font-semibold">
                    {t.name}
                    {t.role ? (
                      <span className="mkt-muted font-normal">
                        {" "}
                        · {t.role}
                        {t.company ? `, ${t.company}` : ""}
                      </span>
                    ) : null}
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Tech stack */}
      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap space-y-8">
          <div className="max-w-2xl space-y-3">
            <p className="mkt-eyebrow">Stack</p>
            <h2 className="text-3xl font-bold sm:text-4xl">Technologies we ship with</h2>
          </div>
          <div className="space-y-5">
            {Object.entries(techStack).map(([group, items]) => (
              <div key={group}>
                <p className="mb-2 text-sm font-semibold">{group}</p>
                <div className="flex flex-wrap gap-2">
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
        <div className="mkt-wrap mkt-card grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="space-y-3">
            <p className="mkt-eyebrow">Product</p>
            <h2 className="text-3xl font-bold">Delvix Autopilot</h2>
            <p className="mkt-muted text-lg">
              Our own client-acquisition platform — separate from studio
              services. Early access for agencies.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/autopilot" className="mkt-btn mkt-btn--primary">
                Learn about Autopilot
              </Link>
              <Link href="/work/revenue-os" className="mkt-btn mkt-btn--secondary">
                How we built it
              </Link>
            </div>
          </div>
          <BrowserFrame
            src="/marketing/screenshots/revenue-os-pipeline.svg"
            alt="Autopilot pipeline placeholder"
          />
        </div>
      </section>

      {/* FAQ */}
      <section className="mkt-section mkt-section--light" id="faq">
        <div className="mkt-wrap grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-3">
            <p className="mkt-eyebrow">FAQ</p>
            <h2 className="text-3xl font-bold sm:text-4xl">Common questions</h2>
          </div>
          <div className="space-y-3">
            {faq.map((f) => (
              <details key={f.q} className="mkt-card group">
                <summary className="cursor-pointer list-none font-semibold">
                  {f.q}
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
          <h2 className="text-3xl font-bold sm:text-5xl">
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

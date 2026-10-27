import Link from "next/link";
import type { Metadata } from "next";
import { SectionCta } from "@/components/marketing/section-cta";
import { services, siteConfig, solutions } from "@/content/site";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Web apps, mobile apps, custom ERP & CRM, AI integrations, automation and project rescue from Delvix Studio.",
  alternates: { canonical: `${siteConfig.url}/services` },
};

export default function ServicesIndexPage() {
  return (
    <>
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-4">
          <p className="mkt-eyebrow">Services</p>
          <h1 className="text-4xl font-extrabold sm:text-5xl">What we build</h1>
          <p className="mkt-muted max-w-2xl text-lg">
            Each card below is a full inner page — open any service for problem,
            approach, capabilities, use cases, process, stack and FAQ.
          </p>
        </div>
      </section>

      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap space-y-10">
          {services.map((s) => (
            <article
              key={s.slug}
              className="mkt-card grid gap-6 lg:grid-cols-[1.1fr_0.9fr]"
            >
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--mkt-accent)]">
                  /services/{s.slug}
                </p>
                <h2 className="text-2xl font-extrabold sm:text-3xl">{s.name}</h2>
                <p className="text-lg font-medium text-[var(--mkt-ink)]">
                  {s.headline}
                </p>
                <p className="mkt-muted text-sm leading-relaxed">{s.short}</p>
                <p className="text-sm leading-relaxed text-[var(--mkt-ink)]">
                  {s.approach}
                </p>
                <ul className="space-y-1 text-sm">
                  {s.outcomes.slice(0, 3).map((o) => (
                    <li key={o} className="mkt-muted">
                      · {o}
                    </li>
                  ))}
                </ul>
                <Link href={`/services/${s.slug}`} className="mkt-btn mkt-btn--primary inline-flex">
                  Open full page →
                </Link>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--mkt-accent)]">
                  Capabilities on this page
                </p>
                <ul className="space-y-2">
                  {s.capabilities.map((c) => (
                    <li key={c.title} className="rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-navy)]/40 px-3 py-2 sm:bg-white/80">
                      <p className="text-sm font-semibold text-[var(--mkt-ink)]">
                        {c.title}
                      </p>
                      <p className="mkt-muted mt-0.5 text-xs leading-snug">
                        {c.body}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-6">
          <div className="max-w-2xl space-y-3">
            <p className="mkt-eyebrow">Also see</p>
            <h2 className="text-3xl font-extrabold">Solutions</h2>
            <p className="mkt-muted">
              Engagement shapes — each has its own full inner page too.
            </p>
          </div>
          <div className="mkt-grid-2">
            {solutions.map((s) => (
              <Link
                key={s.slug}
                href={`/solutions/${s.slug}`}
                className="mkt-card block"
              >
                <p className="mb-1 text-xs text-[var(--mkt-accent)]">
                  /solutions/{s.slug}
                </p>
                <h3 className="mb-2 font-bold">{s.name}</h3>
                <p className="mkt-muted mb-3 text-sm">{s.short}</p>
                <span className="mkt-link text-sm">Open →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <SectionCta />
    </>
  );
}

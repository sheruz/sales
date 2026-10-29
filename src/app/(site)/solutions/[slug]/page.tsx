import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageVisual } from "@/components/marketing/page-visual";
import { SectionCta } from "@/components/marketing/section-cta";
import {
  getService,
  getSolution,
  processSteps,
  siteConfig,
  solutions,
} from "@/content/site";
import { visualForSolution } from "@/lib/marketing/page-visuals";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return solutions.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const s = getSolution(slug);
  if (!s) return {};
  return {
    title: s.name,
    description: s.short,
    alternates: { canonical: `${siteConfig.url}/solutions/${s.slug}` },
  };
}

export default async function SolutionDetailPage({ params }: Props) {
  const { slug } = await params;
  const s = getSolution(slug);
  if (!s) notFound();
  const related = s.relatedServiceSlugs.map((id) => getService(id)).filter(Boolean);

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: s.faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />

      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <p className="mkt-eyebrow">Solution</p>
              <h1 className="text-4xl font-extrabold sm:text-5xl">{s.headline}</h1>
              <p className="mkt-muted text-lg">{s.short}</p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href={siteConfig.contact.bookingUrl}
                  className="mkt-btn mkt-btn--primary"
                  data-mkt-schedule
                >
                  Book a free call
                </Link>
                <Link href="/pricing" className="mkt-btn mkt-btn--secondary">
                  See pricing models
                </Link>
                <Link href="/contact" className="mkt-btn mkt-btn--secondary">
                  Get a quote
                </Link>
              </div>
            </div>
            <PageVisual
              visual={visualForSolution(s.slug)}
              alt={`${s.name} solution mockup`}
              priority
            />
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap grid gap-10 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="mkt-eyebrow">The problem</p>
            <h2 className="text-2xl font-bold">What this usually looks like</h2>
            <p className="leading-relaxed text-[var(--mkt-ink)]">{s.problem}</p>
          </div>
          <div className="space-y-3">
            <p className="mkt-eyebrow">Our approach</p>
            <h2 className="text-2xl font-bold">How we run it</h2>
            <p className="leading-relaxed text-[var(--mkt-ink)]">{s.approach}</p>
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap grid gap-10 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="mkt-eyebrow">Who it fits</p>
            <ul className="space-y-2">
              {s.whoFor.map((line) => (
                <li key={line} className="mkt-card text-sm">
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <p className="mkt-eyebrow">Outcomes</p>
            <ul className="space-y-2">
              {s.outcomes.map((line) => (
                <li key={line} className="mkt-card text-sm">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap space-y-8">
          <div className="max-w-2xl space-y-3">
            <p className="mkt-eyebrow">Capabilities</p>
            <h2 className="text-3xl font-extrabold">What this engagement covers</h2>
          </div>
          <div className="mkt-grid-2">
            {s.capabilities.map((c) => (
              <div key={c.title} className="mkt-card">
                <h3 className="mb-2 text-lg font-bold">{c.title}</h3>
                <p className="mkt-muted text-sm leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <div className="max-w-2xl space-y-3">
            <p className="mkt-eyebrow">Shapes</p>
            <h2 className="text-3xl font-extrabold">How teams use this</h2>
          </div>
          <div className="mkt-grid-2">
            {s.useCases.map((u) => (
              <div key={u.title} className="mkt-card">
                <h3 className="mb-2 text-lg font-bold">{u.title}</h3>
                <p className="mkt-muted text-sm leading-relaxed">{u.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap grid gap-10 lg:grid-cols-2">
          <div>
            <p className="mkt-eyebrow mb-3">Includes</p>
            <ul className="space-y-2">
              {s.includes.map((line) => (
                <li key={line} className="mkt-card text-sm">
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mkt-eyebrow mb-3">Deliverables</p>
            <ul className="space-y-2">
              {s.deliverables.map((line) => (
                <li key={line} className="mkt-card text-sm">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mkt-eyebrow mb-2">Process</p>
              <h2 className="text-3xl font-extrabold">How work runs</h2>
            </div>
            <Link href="/process" className="mkt-link text-sm">
              Full process →
            </Link>
          </div>
          <ol className="mkt-grid-3 list-none p-0">
            {processSteps.map((step) => (
              <li key={step.n} className="mkt-card">
                <p className="mb-2 font-mono text-sm text-[var(--mkt-accent)]">
                  {step.n}
                </p>
                <h3 className="mb-1 font-bold">{step.title}</h3>
                <p className="mkt-muted text-sm">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap space-y-8">
          <p className="mkt-eyebrow">Why Delvix</p>
          <div className="mkt-grid-2">
            {s.whyUs.map((w) => (
              <div key={w.title} className="mkt-card">
                <h3 className="mb-2 text-lg font-bold">{w.title}</h3>
                <p className="mkt-muted text-sm leading-relaxed">{w.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {related.length > 0 ? (
        <section className="mkt-section mkt-section--dark">
          <div className="mkt-wrap space-y-6">
            <p className="mkt-eyebrow">Often pairs with</p>
            <div className="mkt-grid-3">
              {related.map((svc) =>
                svc ? (
                  <Link
                    key={svc.slug}
                    href={`/services/${svc.slug}`}
                    className="mkt-card block"
                  >
                    <h3 className="mb-2 font-bold">{svc.name}</h3>
                    <p className="mkt-muted mb-2 text-sm">{svc.short}</p>
                    <span className="mkt-link text-sm">Service →</span>
                  </Link>
                ) : null
              )}
            </div>
          </div>
        </section>
      ) : null}

      {s.faq.length > 0 ? (
        <section className="mkt-section mkt-section--light">
          <div className="mkt-wrap max-w-3xl space-y-4">
            <p className="mkt-eyebrow">FAQ</p>
            {s.faq.map((f) => (
              <details key={f.q} className="mkt-card">
                <summary className="cursor-pointer font-semibold">{f.q}</summary>
                <p className="mkt-muted mt-3 text-sm">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      <SectionCta title={`Talk about ${s.name.toLowerCase()}`} />
    </>
  );
}

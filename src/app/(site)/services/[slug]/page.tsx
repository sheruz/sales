import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SectionCta } from "@/components/marketing/section-cta";
import {
  getService,
  getSolution,
  processSteps,
  services,
  siteConfig,
} from "@/content/site";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return services.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const s = getService(slug);
  if (!s) return {};
  return {
    title: s.name,
    description: s.short,
    alternates: { canonical: `${siteConfig.url}/services/${s.slug}` },
  };
}

export default async function ServiceDetailPage({ params }: Props) {
  const { slug } = await params;
  const s = getService(slug);
  if (!s) notFound();

  const relatedSolutions = (s.relatedSolutionSlugs || [])
    .map((id) => getSolution(id))
    .filter(Boolean);

  const serviceLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: s.name,
    description: s.short,
    provider: { "@type": "Organization", name: siteConfig.name },
  };

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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />

      {/* Hero */}
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap max-w-3xl space-y-6">
          <p className="mkt-eyebrow">Service</p>
          <h1 className="text-4xl font-extrabold sm:text-5xl">{s.headline}</h1>
          <p className="mkt-muted text-lg">{s.short}</p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={siteConfig.contact.bookingUrl}
              className="mkt-btn mkt-btn--primary"
              data-mkt-schedule
            >
              Book a free call
            </Link>
            <Link href="/contact" className="mkt-btn mkt-btn--secondary">
              Get a quote
            </Link>
            <Link href="/pricing" className="mkt-btn mkt-btn--secondary">
              See pricing models
            </Link>
          </div>
        </div>
      </section>

      {/* Problem + approach */}
      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap grid gap-10 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="mkt-eyebrow">The problem</p>
            <h2 className="text-2xl font-bold">What this usually looks like</h2>
            <p className="leading-relaxed text-[var(--mkt-ink)]">{s.problem}</p>
          </div>
          <div className="space-y-3">
            <p className="mkt-eyebrow">Our approach</p>
            <h2 className="text-2xl font-bold">How we solve it</h2>
            <p className="leading-relaxed text-[var(--mkt-ink)]">{s.approach}</p>
          </div>
        </div>
      </section>

      {/* Who + outcomes */}
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

      {/* Capabilities */}
      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap space-y-8">
          <div className="max-w-2xl space-y-3">
            <p className="mkt-eyebrow">Capabilities</p>
            <h2 className="text-3xl font-extrabold">
              What we deliver under {s.name.toLowerCase()}
            </h2>
          </div>
          <div className="mkt-grid-3">
            {s.capabilities.map((c) => (
              <div key={c.title} className="mkt-card">
                <h3 className="mb-2 text-lg font-bold">{c.title}</h3>
                <p className="mkt-muted text-sm leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <div className="max-w-2xl space-y-3">
            <p className="mkt-eyebrow">In production shapes</p>
            <h2 className="text-3xl font-extrabold">
              How this shows up for real teams
            </h2>
            <p className="mkt-muted">
              Example shapes — not invented client logos. Your scope will name
              the exact cut.
            </p>
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

      {/* Build list + deliverables */}
      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap grid gap-10 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="mkt-eyebrow">What we build</p>
            <ul className="space-y-2">
              {s.whatWeBuild.map((line) => (
                <li key={line} className="mkt-card text-sm">
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <p className="mkt-eyebrow">Deliverables</p>
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

      {/* Process */}
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mkt-eyebrow mb-2">Process</p>
              <h2 className="text-3xl font-extrabold">How the build runs</h2>
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

      {/* Why Delvix */}
      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap space-y-8">
          <div className="max-w-2xl space-y-3">
            <p className="mkt-eyebrow">Why Delvix</p>
            <h2 className="text-3xl font-extrabold">
              How we work on {s.name.toLowerCase()}
            </h2>
          </div>
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

      {/* Stack */}
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-6">
          <p className="mkt-eyebrow">Technologies</p>
          <h2 className="text-2xl font-bold">Stack we commonly use</h2>
          <div className="flex flex-wrap gap-2">
            {s.stack.map((t) => (
              <span key={t} className="mkt-badge">
                {t}
              </span>
            ))}
          </div>
          <Link href="/technologies" className="mkt-link text-sm">
            All technologies →
          </Link>
        </div>
      </section>

      {relatedSolutions.length > 0 ? (
        <section className="mkt-section mkt-section--light">
          <div className="mkt-wrap space-y-6">
            <p className="mkt-eyebrow">Related solutions</p>
            <div className="mkt-grid-2">
              {relatedSolutions.map((sol) =>
                sol ? (
                  <Link
                    key={sol.slug}
                    href={`/solutions/${sol.slug}`}
                    className="mkt-card block"
                  >
                    <h3 className="mb-2 text-xl font-bold">{sol.name}</h3>
                    <p className="mkt-muted mb-3 text-sm">{sol.short}</p>
                    <span className="mkt-link text-sm">Learn more →</span>
                  </Link>
                ) : null
              )}
            </div>
          </div>
        </section>
      ) : null}

      {s.faq.length > 0 ? (
        <section className="mkt-section mkt-section--dark">
          <div className="mkt-wrap max-w-3xl space-y-4">
            <p className="mkt-eyebrow">FAQ</p>
            <h2 className="text-3xl font-bold">
              Your {s.name.toLowerCase()} questions
            </h2>
            {s.faq.map((f) => (
              <details key={f.q} className="mkt-card">
                <summary className="cursor-pointer font-semibold">{f.q}</summary>
                <p className="mkt-muted mt-3 text-sm">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      <SectionCta
        title={`Get a free ${s.name.toLowerCase()} estimate`}
        sub="Discovery call, then a written scope — before any build starts."
      />
    </>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SectionCta } from "@/components/marketing/section-cta";
import {
  getCaseStudy,
  getIndustry,
  getService,
  industries,
  processSteps,
  siteConfig,
} from "@/content/site";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return industries.map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const i = getIndustry(slug);
  if (!i) return {};
  return {
    title: i.name,
    description: i.short,
    alternates: { canonical: `${siteConfig.url}/industries/${i.slug}` },
  };
}

export default async function IndustryDetailPage({ params }: Props) {
  const { slug } = await params;
  const i = getIndustry(slug);
  if (!i) notFound();
  const related = i.relatedCaseStudySlug
    ? getCaseStudy(i.relatedCaseStudySlug)
    : null;
  const relatedServices = (i.relatedServiceSlugs || [])
    .map((id) => getService(id))
    .filter(Boolean);

  return (
    <>
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap max-w-3xl space-y-4">
          <p className="mkt-eyebrow">Industry</p>
          <h1 className="text-4xl font-extrabold sm:text-5xl">{i.headline}</h1>
          <p className="mkt-muted text-lg">{i.short}</p>
          <p className="leading-relaxed text-[var(--mkt-ink)]">{i.approach}</p>
          <div className="flex flex-wrap gap-3 pt-2">
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
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap grid gap-10 lg:grid-cols-2">
          <div>
            <p className="mkt-eyebrow mb-3">Common problems</p>
            <ul className="space-y-2">
              {i.problems.map((p) => (
                <li key={p} className="mkt-card text-sm">
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mkt-eyebrow mb-3">What we build</p>
            <ul className="space-y-2">
              {i.whatWeBuild.map((p) => (
                <li key={p} className="mkt-card text-sm">
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <div className="max-w-2xl space-y-3">
            <p className="mkt-eyebrow">Capabilities</p>
            <h2 className="text-3xl font-extrabold">
              What we typically ship for {i.name.toLowerCase()}
            </h2>
          </div>
          <div className="mkt-grid-2">
            {i.capabilities.map((c) => (
              <div key={c.title} className="mkt-card">
                <h3 className="mb-2 text-lg font-bold">{c.title}</h3>
                <p className="mkt-muted text-sm leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap space-y-8">
          <div className="max-w-2xl space-y-3">
            <p className="mkt-eyebrow">Modules</p>
            <h2 className="text-3xl font-extrabold">Typical building blocks</h2>
            <p className="mkt-muted">
              Exact modules are written into your scope — this is the usual menu.
            </p>
          </div>
          <ul className="mkt-grid-3">
            {i.modules.map((m) => (
              <li key={m} className="mkt-card text-sm font-medium">
                {m}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <p className="mkt-eyebrow">Outcomes</p>
          <ul className="mkt-grid-3">
            {i.outcomes.map((o) => (
              <li key={o} className="mkt-card text-sm leading-relaxed">
                {o}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mkt-eyebrow mb-2">Process</p>
              <h2 className="text-3xl font-extrabold">How we engage</h2>
            </div>
            <Link href="/process" className="mkt-link text-sm">
              Full process →
            </Link>
          </div>
          <ol className="mkt-grid-3 list-none p-0">
            {processSteps.slice(0, 3).map((step) => (
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

      {relatedServices.length > 0 ? (
        <section className="mkt-section mkt-section--dark">
          <div className="mkt-wrap space-y-6">
            <p className="mkt-eyebrow">Related services</p>
            <div className="mkt-grid-3">
              {relatedServices.map((s) =>
                s ? (
                  <Link
                    key={s.slug}
                    href={`/services/${s.slug}`}
                    className="mkt-card block"
                  >
                    <h3 className="mb-2 font-bold">{s.name}</h3>
                    <p className="mkt-muted mb-3 text-sm">{s.short}</p>
                    <span className="mkt-link text-sm">Learn more →</span>
                  </Link>
                ) : null
              )}
            </div>
          </div>
        </section>
      ) : null}

      {related ? (
        <section className="mkt-section mkt-section--light">
          <div className="mkt-wrap">
            <Link href={`/work/${related.slug}`} className="mkt-card block max-w-2xl">
              <p className="mkt-eyebrow mb-2">Related work</p>
              <h2 className="text-2xl font-bold">{related.title}</h2>
              <p className="mkt-muted mt-2 text-sm">{related.clientType}</p>
            </Link>
          </div>
        </section>
      ) : null}

      {i.faq.length > 0 ? (
        <section className="mkt-section mkt-section--dark">
          <div className="mkt-wrap max-w-3xl space-y-4">
            <p className="mkt-eyebrow">FAQ</p>
            {i.faq.map((f) => (
              <details key={f.q} className="mkt-card">
                <summary className="cursor-pointer font-semibold">{f.q}</summary>
                <p className="mkt-muted mt-3 text-sm">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      <SectionCta title={`Building for ${i.name.toLowerCase()}?`} />
    </>
  );
}

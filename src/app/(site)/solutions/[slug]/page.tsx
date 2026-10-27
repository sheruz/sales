import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SectionCta } from "@/components/marketing/section-cta";
import {
  getService,
  getSolution,
  siteConfig,
  solutions,
} from "@/content/site";

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

  return (
    <>
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap max-w-3xl space-y-4">
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
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap max-w-3xl space-y-4">
          <p className="mkt-eyebrow">Problem</p>
          <p className="leading-relaxed text-[var(--mkt-ink)]">{s.problem}</p>
        </div>
      </section>

      <section className="mkt-section mkt-section--dark">
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
            <p className="mkt-eyebrow mb-3">Outcomes</p>
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

      {related.length > 0 ? (
        <section className="mkt-section mkt-section--light">
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
                    <span className="mkt-link text-sm">Service →</span>
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

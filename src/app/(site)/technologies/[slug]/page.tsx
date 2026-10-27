import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SectionCta } from "@/components/marketing/section-cta";
import {
  getService,
  getTechnology,
  siteConfig,
  technologies,
} from "@/content/site";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return technologies.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const t = getTechnology(slug);
  if (!t) return {};
  return {
    title: t.name,
    description: t.short,
    alternates: { canonical: `${siteConfig.url}/technologies/${t.slug}` },
  };
}

export default async function TechnologyDetailPage({ params }: Props) {
  const { slug } = await params;
  const t = getTechnology(slug);
  if (!t) notFound();
  const related = t.relatedServiceSlugs.map((id) => getService(id)).filter(Boolean);

  return (
    <>
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap max-w-3xl space-y-4">
          <p className="mkt-eyebrow">{t.group}</p>
          <h1 className="text-4xl font-extrabold sm:text-5xl">{t.name}</h1>
          <p className="mkt-muted text-lg">{t.short}</p>
        </div>
      </section>
      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap max-w-3xl space-y-4">
          <p className="mkt-eyebrow">When we use it</p>
          <ul className="space-y-2">
            {t.whenWeUseIt.map((line) => (
              <li key={line} className="mkt-card text-sm">
                {line}
              </li>
            ))}
          </ul>
        </div>
      </section>
      {related.length > 0 ? (
        <section className="mkt-section mkt-section--dark">
          <div className="mkt-wrap space-y-6">
            <p className="mkt-eyebrow">Related services</p>
            <div className="mkt-grid-3">
              {related.map((s) =>
                s ? (
                  <Link
                    key={s.slug}
                    href={`/services/${s.slug}`}
                    className="mkt-card block"
                  >
                    <h2 className="mb-2 font-bold">{s.name}</h2>
                    <span className="mkt-link text-sm">Learn more →</span>
                  </Link>
                ) : null
              )}
            </div>
          </div>
        </section>
      ) : null}
      <SectionCta title={`Building with ${t.name}?`} />
    </>
  );
}

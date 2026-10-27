import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getCaseStudy,
  getIndustry,
  industries,
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

  return (
    <>
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap max-w-3xl space-y-4">
          <p className="mkt-eyebrow">Industry</p>
          <h1 className="text-4xl font-extrabold sm:text-5xl">{i.name}</h1>
          <p className="mkt-muted text-lg">{i.short}</p>
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
      {related ? (
        <section className="mkt-section mkt-section--dark">
          <div className="mkt-wrap">
            <Link href={`/work/${related.slug}`} className="mkt-card block max-w-2xl">
              <p className="mkt-eyebrow mb-2">Related work</p>
              <h2 className="text-2xl font-bold">{related.title}</h2>
              <p className="mkt-muted mt-2 text-sm">{related.clientType}</p>
            </Link>
          </div>
        </section>
      ) : null}
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap text-center">
          <Link
            href={siteConfig.contact.bookingUrl}
            className="mkt-btn mkt-btn--primary"
            data-mkt-schedule
          >
            Book a free call
          </Link>
        </div>
      </section>
    </>
  );
}

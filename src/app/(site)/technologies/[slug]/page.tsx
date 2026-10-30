import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FaqBlock, JsonLd } from "@/components/marketing/faq-block";
import { PageBreadcrumb } from "@/components/marketing/page-breadcrumb";
import { PageVisual } from "@/components/marketing/page-visual";
import { RelatedPages } from "@/components/marketing/related-pages";
import { SectionCta } from "@/components/marketing/section-cta";
import { getTechnologyPage, technologyPages } from "@/content/pages";
import { siteConfig } from "@/content/site";
import { buildPageMetadata } from "@/lib/marketing/page-metadata";
import { firstSentence } from "@/lib/marketing/nav-lookup";
import {
  bodyVisualForTechnology,
  visualForTechnology,
} from "@/lib/marketing/page-visuals";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return technologyPages.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getTechnologyPage(slug);
  if (!page) return {};
  return buildPageMetadata({
    title: page.seoTitle,
    description: page.seoDescription,
    path: `/technologies/${page.slug}`,
  });
}

export default async function TechnologyDetailPage({ params }: Props) {
  const { slug } = await params;
  const page = getTechnologyPage(slug);
  if (!page) notFound();

  const path = `/technologies/${page.slug}`;
  const visual = visualForTechnology(page.slug);
  const bodyVisual = bodyVisualForTechnology(page.slug);
  const whyParagraphs = page.whyWeUseIt
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: page.h1,
          description: page.seoDescription,
          url: `${siteConfig.url}${path}`,
          provider: {
            "@type": "Organization",
            name: siteConfig.name,
            url: siteConfig.url,
          },
        }}
      />

      {/* Hero + breadcrumb */}
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <PageBreadcrumb
            section={{ label: "Technologies", href: "/technologies" }}
            current={page.name}
            currentPath={path}
          />
          <div className="mkt-split">
            <div className="space-y-6">
              <p className="mkt-eyebrow">{page.group}</p>
              <h1 className="text-4xl font-extrabold text-balance sm:text-5xl">
                {page.h1}
              </h1>
              <p className="mkt-muted text-lg">{firstSentence(page.whyWeUseIt)}</p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={siteConfig.contact.bookingUrl}
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
            <PageVisual visual={visual} alt={`${page.name} stack mockup`} priority />
          </div>
        </div>
      </section>

      {/* Why we use it */}
      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap mkt-split">
          <div className="mkt-prose space-y-4">
            <p className="mkt-eyebrow">Why we use it</p>
            <h2 className="text-3xl font-extrabold text-balance">
              Why we build with {page.name}
            </h2>
            {whyParagraphs.map((p) => (
              <p key={p} className="text-lg leading-relaxed">
                {p}
              </p>
            ))}
          </div>
          <PageVisual visual={bodyVisual} alt={`${page.name} in production`} />
        </div>
      </section>

      {/* What we build */}
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <div className="max-w-2xl space-y-3">
            <p className="mkt-eyebrow">What we build</p>
            <h2 className="text-3xl font-extrabold">
              What we build with {page.name}
            </h2>
          </div>
          <div className="mkt-grid-2">
            {page.whatWeBuild.map((b) => (
              <div key={b.title} className="mkt-card">
                <h3 className="mb-2 text-lg font-bold">{b.title}</h3>
                <p className="mkt-muted text-sm leading-relaxed">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stack fit + when something else */}
      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap grid gap-10 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="mkt-eyebrow">How it fits our stack</p>
            <h2 className="text-2xl font-bold">What we pair it with</h2>
            <p className="leading-relaxed">{page.stackFit}</p>
          </div>
          <div className="space-y-3">
            <p className="mkt-eyebrow">Honest advice</p>
            <h2 className="text-2xl font-bold">When something else is better</h2>
            <p className="leading-relaxed">{page.whenSomethingElse}</p>
          </div>
        </div>
      </section>

      <FaqBlock items={page.faq} tone="dark" />
      <RelatedPages links={page.relatedPages} tone="light" />
      <SectionCta
        title={`Thinking about ${page.name} for your project?`}
        sub="Tell us what you want to build and we will say plainly whether it is the right fit."
      />
    </>
  );
}

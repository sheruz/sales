import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FaqBlock, JsonLd } from "@/components/marketing/faq-block";
import { PageBreadcrumb } from "@/components/marketing/page-breadcrumb";
import { PageVisual } from "@/components/marketing/page-visual";
import { SlotImage } from "@/components/marketing/slot-image";
import { RelatedPages } from "@/components/marketing/related-pages";
import { SectionCta } from "@/components/marketing/section-cta";
import { getIndustryPage, industryPages } from "@/content/pages";
import { siteConfig } from "@/content/site";
import { buildPageMetadata } from "@/lib/marketing/page-metadata";
import {
  bodyVisualForIndustry,
  visualForIndustry,
} from "@/lib/marketing/page-visuals";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return industryPages.map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getIndustryPage(slug);
  if (!page) return {};
  return buildPageMetadata({
    title: page.seoTitle,
    description: page.seoDescription,
    path: `/industries/${page.slug}`,
  });
}

export default async function IndustryDetailPage({ params }: Props) {
  const { slug } = await params;
  const page = getIndustryPage(slug);
  if (!page) notFound();

  const path = `/industries/${page.slug}`;
  const visual = visualForIndustry(page.slug);
  const bodyVisual = bodyVisualForIndustry(page.slug);
  const introParagraphs = page.intro
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
      <section className="relative mkt-section mkt-section--dark overflow-hidden">
        {page.slug === "logistics-trucking" && (
          <div className="absolute inset-0 -z-10">
            <SlotImage
              slot="IND-01"
              alt="Logistics and trucking operations"
              fill
              priority
              sizes="100vw"
            />
            <div
              className="absolute inset-0"
              style={{
                background: "rgba(11, 18, 32, 0.7)",
              }}
            />
          </div>
        )}
        <div className="mkt-wrap space-y-8">
          <PageBreadcrumb
            section={{ label: "Industries", href: "/industries" }}
            current={page.name}
            currentPath={path}
          />
          <div className="mkt-split">
            <div className="space-y-6">
              <p className="mkt-eyebrow">Industry</p>
              <h1 className="text-4xl font-extrabold text-balance sm:text-5xl">
                {page.h1}
              </h1>
              <p className="mkt-muted text-lg">{page.subline}</p>
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
            {page.slug !== "logistics-trucking" && (
              <PageVisual
                visual={visual}
                alt={`${page.name} software mockup`}
                priority
              />
            )}
          </div>
        </div>
      </section>

      {/* Intro */}
      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap mkt-split">
          <div className="mkt-prose space-y-4">
            {introParagraphs.map((p) => (
              <p key={p} className="text-lg leading-relaxed">
                {p}
              </p>
            ))}
          </div>
          <PageVisual visual={bodyVisual} alt={`${page.name} workflow`} />
        </div>
      </section>

      {/* Common problems */}
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <div className="max-w-2xl space-y-3">
            <p className="mkt-eyebrow">Common problems</p>
            <h2 className="text-3xl font-extrabold">
              What {page.name.toLowerCase()} teams tell us
            </h2>
          </div>
          <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
            {page.problems.map((p) => (
              <li key={p} className="mkt-card text-sm leading-relaxed">
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* What we build */}
      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap space-y-16">
          <div className="max-w-2xl space-y-3">
            <p className="mkt-eyebrow">What we build</p>
            <h2 className="text-3xl font-extrabold">
              Tools built around your workflow
            </h2>
          </div>
          {page.slug === "logistics-trucking" ? (
            <div className="space-y-20">
              {page.whatWeBuild.map((b, i) => {
                const slots = ["IND-02", "IND-03", "IND-04", "IND-05"];
                const slot = slots[i] || "IND-02";
                const isEven = i % 2 === 0;
                return (
                  <div
                    key={b.title}
                    className={`flex flex-wrap items-center gap-8 lg:gap-12 ${
                      isEven ? "" : "lg:flex-row-reverse"
                    }`}
                  >
                    <div className="min-w-0 flex-[1_1_280px]">
                      <SlotImage
                        slot={slot}
                        alt={b.title}
                        width={1600}
                        height={1100}
                        aspectRatio="16/11"
                        className="w-full rounded-2xl"
                      />
                    </div>
                    <div className="min-w-0 flex-[1_1_260px] space-y-4">
                      <h3 className="text-2xl font-extrabold sm:text-3xl">{b.title}</h3>
                      <p className="mkt-muted text-base leading-relaxed">{b.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mkt-grid-3">
              {page.whatWeBuild.map((b) => (
                <div key={b.title} className="mkt-card">
                  <h3 className="mb-2 text-lg font-bold">{b.title}</h3>
                  <p className="mkt-muted text-sm leading-relaxed">{b.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Before / after */}
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <div className="max-w-2xl space-y-3">
            <p className="mkt-eyebrow">Before and after</p>
            <h2 className="text-3xl font-extrabold">
              How the day-to-day workflow changes
            </h2>
          </div>
          <div className="mkt-card overflow-x-auto">
            <table className="mkt-table">
              <thead>
                <tr>
                  <th scope="col">Before</th>
                  <th scope="col">After</th>
                </tr>
              </thead>
              <tbody>
                {page.beforeAfter.map((row) => (
                  <tr key={row.before}>
                    <td>{row.before}</td>
                    <td>{row.after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Integrations */}
      {page.integrations.length > 0 ? (
        <section className="mkt-section mkt-section--light">
          <div className="mkt-wrap space-y-6">
            <p className="mkt-eyebrow">Integrations</p>
            <h2 className="text-2xl font-bold">Works with tools you already use</h2>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {page.integrations.map((i) => (
                <li key={i} className="mkt-badge">
                  {i}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* Free audit CTA */}
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap max-w-3xl space-y-4">
          <p className="mkt-eyebrow">Free audit</p>
          <h2 className="text-3xl font-extrabold">{page.auditCta.title}</h2>
          <p className="mkt-muted text-lg leading-relaxed">{page.auditCta.body}</p>
          <Link href="/free-audit" className="mkt-btn mkt-btn--primary inline-flex">
            Get a free audit
          </Link>
        </div>
      </section>

      <FaqBlock items={page.faq} tone="light" />
      <RelatedPages links={page.relatedPages} tone="dark" />
      <SectionCta
        title={`Talk to us about software for ${page.name.toLowerCase()}`}
        sub="A short call, then a written scope in plain language before any build starts."
      />
    </>
  );
}

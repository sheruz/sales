import Link from "next/link";
import { FaqBlock, JsonLd } from "@/components/marketing/faq-block";
import { PageBreadcrumb } from "@/components/marketing/page-breadcrumb";
import { PageVisual } from "@/components/marketing/page-visual";
import { RelatedPages } from "@/components/marketing/related-pages";
import { SectionCta } from "@/components/marketing/section-cta";
import { getTechnologyPage } from "@/content/pages";
import type { AiPageContent, ServicePageContent } from "@/content/pages";
import { getCaseStudy, siteConfig } from "@/content/site";
import {
  bodyVisualForAi,
  bodyVisualForService,
  visualForAi,
  visualForService,
} from "@/lib/marketing/page-visuals";

type Props = {
  page: ServicePageContent | AiPageContent;
  /** Route prefix, e.g. "/services" or "/ai" */
  basePath: "/services" | "/ai";
  sectionLabel: string;
  eyebrow: string;
};

function isAiPage(p: ServicePageContent | AiPageContent): p is AiPageContent {
  return "whereHelps" in p && "dataPrivacy" in p;
}

/** Shared inner-page template for /services/[slug] and /ai/[slug]. */
export function ServicePageView({ page, basePath, sectionLabel, eyebrow }: Props) {
  const path = `${basePath}/${page.slug}`;
  const caseStudy = page.relatedCaseStudySlug
    ? getCaseStudy(page.relatedCaseStudySlug)
    : null;
  const techLinks = page.techSlugs
    .map((slug) => getTechnologyPage(slug))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));
  const introParagraphs = page.intro
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const visual =
    basePath === "/ai" ? visualForAi(page.slug) : visualForService(page.slug);
  const bodyVisual =
    basePath === "/ai"
      ? bodyVisualForAi(page.slug)
      : bodyVisualForService(page.slug);

  // Hero is dark; alternate from there.
  let n = 0;
  const tone = (): "light" | "dark" => (n++ % 2 === 0 ? "light" : "dark");

  const serviceLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: page.h1,
    description: page.seoDescription,
    url: `${siteConfig.url}${path}`,
    provider: { "@type": "Organization", name: siteConfig.name, url: siteConfig.url },
  };

  return (
    <>
      <JsonLd data={serviceLd} />

      {/* Hero + breadcrumb */}
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <PageBreadcrumb
            section={{ label: sectionLabel, href: basePath }}
            current={page.h1}
            currentPath={path}
          />
          <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <p className="mkt-eyebrow">{eyebrow}</p>
              <h1 className="text-4xl font-extrabold sm:text-5xl">{page.h1}</h1>
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
            <PageVisual visual={visual} alt={`${page.h1} product mockup`} priority />
          </div>
        </div>
      </section>

      {/* Intro */}
      <section className={`mkt-section mkt-section--${tone()}`}>
        <div className="mkt-wrap mkt-split">
          <div className="mkt-prose space-y-4">
            {introParagraphs.map((p) => (
              <p key={p} className="text-lg leading-relaxed">
                {p}
              </p>
            ))}
          </div>
          <PageVisual visual={bodyVisual} alt={`${page.h1} workflow`} />
        </div>
      </section>

      {/* Problems */}
      <section className={`mkt-section mkt-section--${tone()}`}>
        <div className="mkt-wrap space-y-8">
          <div className="max-w-2xl space-y-3">
            <p className="mkt-eyebrow">The problems</p>
            <h2 className="text-3xl font-extrabold">What usually goes wrong</h2>
          </div>
          <div className="mkt-grid-2">
            {page.problems.map((b) => (
              <div key={b.title} className="mkt-card">
                <h3 className="mb-2 text-lg font-bold">{b.title}</h3>
                <p className="mkt-muted text-sm leading-relaxed">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className={`mkt-section mkt-section--${tone()}`}>
        <div className="mkt-wrap space-y-8">
          <div className="max-w-2xl space-y-3">
            <p className="mkt-eyebrow">What you get</p>
            <h2 className="text-3xl font-extrabold">Deliverables</h2>
          </div>
          <div className="mkt-grid-3">
            {page.deliverables.map((b) => (
              <div key={b.title} className="mkt-card">
                <h3 className="mb-2 text-lg font-bold">{b.title}</h3>
                <p className="mkt-muted text-sm leading-relaxed">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className={`mkt-section mkt-section--${tone()}`}>
        <div className="mkt-wrap space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-3">
              <p className="mkt-eyebrow">How it works</p>
              <h2 className="text-3xl font-extrabold">Step by step</h2>
            </div>
            <Link href="/process" className="mkt-link text-sm">
              Our full process →
            </Link>
          </div>
          <ol className="mkt-grid-3 list-none p-0">
            {page.steps.map((s, i) => (
              <li key={s.title} className="mkt-card">
                <p className="mb-2 font-mono text-sm text-[var(--mkt-accent)]">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="mb-1 font-bold">{s.title}</h3>
                <p className="mkt-muted text-sm leading-relaxed">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Timeline */}
      <section className={`mkt-section mkt-section--${tone()}`}>
        <div className="mkt-wrap max-w-3xl space-y-3">
          <p className="mkt-eyebrow">Timeline</p>
          <h2 className="text-3xl font-extrabold">How long it typically takes</h2>
          <p className="text-lg leading-relaxed">{page.timeline}</p>
        </div>
      </section>

      {/* Tech */}
      {techLinks.length > 0 ? (
        <section className={`mkt-section mkt-section--${tone()}`}>
          <div className="mkt-wrap space-y-6">
            <p className="mkt-eyebrow">Tech we use</p>
            <h2 className="text-2xl font-bold">Tools we commonly build with</h2>
            <div className="flex flex-wrap gap-2">
              {techLinks.map((t) => (
                <Link
                  key={t.slug}
                  href={`/technologies/${t.slug}`}
                  className="mkt-badge"
                >
                  {t.name}
                </Link>
              ))}
            </div>
            <Link href="/technologies" className="mkt-link text-sm">
              All technologies →
            </Link>
          </div>
        </section>
      ) : null}

      {/* Who for / not for */}
      <section className={`mkt-section mkt-section--${tone()}`}>
        <div className="mkt-wrap grid gap-10 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="mkt-eyebrow">Who it&apos;s for</p>
            <ul className="m-0 list-none space-y-2 p-0">
              {page.whoFor.map((line) => (
                <li key={line} className="mkt-card text-sm">
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <p className="mkt-eyebrow">Who it&apos;s not for</p>
            <ul className="m-0 list-none space-y-2 p-0">
              {page.whoNotFor.map((line) => (
                <li key={line} className="mkt-card text-sm">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* AI extras */}
      {isAiPage(page) ? (
        <>
          <section className={`mkt-section mkt-section--${tone()}`}>
            <div className="mkt-wrap space-y-8">
              <div className="max-w-2xl space-y-3">
                <p className="mkt-eyebrow">Honest scoping</p>
                <h2 className="text-3xl font-extrabold">
                  Where AI helps, and where it doesn&apos;t
                </h2>
              </div>
              <div className="grid gap-10 lg:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="text-xl font-bold">Where AI helps</h3>
                  <ul className="m-0 list-none space-y-2 p-0">
                    {page.whereHelps.map((line) => (
                      <li key={line} className="mkt-card text-sm">
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-3">
                  <h3 className="text-xl font-bold">Where it doesn&apos;t</h3>
                  <ul className="m-0 list-none space-y-2 p-0">
                    {page.whereDoesnt.map((line) => (
                      <li key={line} className="mkt-card text-sm">
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section className={`mkt-section mkt-section--${tone()}`}>
            <div className="mkt-wrap max-w-3xl space-y-3">
              <p className="mkt-eyebrow">Data privacy</p>
              <h2 className="text-3xl font-extrabold">Your data stays yours</h2>
              <p className="text-lg leading-relaxed">{page.dataPrivacy}</p>
              <Link href="/security" className="mkt-link text-sm">
                How we handle security →
              </Link>
            </div>
          </section>
        </>
      ) : null}

      {/* Related case study (verified only) */}
      {caseStudy ? (
        <section className={`mkt-section mkt-section--${tone()}`}>
          <div className="mkt-wrap max-w-3xl space-y-4">
            <p className="mkt-eyebrow">Related case study</p>
            <Link href={`/work/${caseStudy.slug}`} className="mkt-card block">
              <p className="mkt-muted mb-1 text-xs">{caseStudy.clientType}</p>
              <h3 className="mb-2 text-xl font-bold">{caseStudy.title}</h3>
              <p className="mkt-muted mb-3 text-sm leading-relaxed">
                {caseStudy.problem}
              </p>
              <span className="mkt-link text-sm">Read the case study →</span>
            </Link>
          </div>
        </section>
      ) : null}

      <RelatedPages links={page.relatedPages} tone={tone()} />

      <FaqBlock items={page.faq} tone={tone()} />

      <SectionCta
        title="Tell us what you want to build"
        sub="A short call, then a written scope in plain language before any build starts."
      />
    </>
  );
}

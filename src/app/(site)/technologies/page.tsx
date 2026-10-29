import Link from "next/link";
import type { Metadata } from "next";
import { PageBreadcrumb } from "@/components/marketing/page-breadcrumb";
import { PageVisual } from "@/components/marketing/page-visual";
import { RelatedPages } from "@/components/marketing/related-pages";
import { SectionCta } from "@/components/marketing/section-cta";
import { VisualThumb } from "@/components/marketing/visual-thumb";
import { technologyPages } from "@/content/pages";
import { buildPageMetadata } from "@/lib/marketing/page-metadata";
import { firstSentence } from "@/lib/marketing/nav-lookup";
import { visualForPath, visualForTechnology } from "@/lib/marketing/page-visuals";

export const metadata: Metadata = buildPageMetadata({
  title: "Technologies We Build With | Delvix Studio",
  description:
    "Next.js, React, Node.js, Laravel, Python, React Native, Flutter, PostgreSQL, AWS and AI platforms. Why we use each one and when we would suggest something else.",
  path: "/technologies",
});

export default function TechnologiesIndexPage() {
  const groups: Array<{ heading: string; items: typeof technologyPages }> = [];
  for (const t of technologyPages) {
    const existing = groups.find((g) => g.heading === t.group);
    if (existing) existing.items.push(t);
    else groups.push({ heading: t.group, items: [t] });
  }

  return (
    <>
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <PageBreadcrumb current="Technologies" currentPath="/technologies" />
          <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <p className="mkt-eyebrow">Technologies</p>
              <h1 className="max-w-3xl text-4xl font-extrabold sm:text-5xl">
                Mainstream tools you will never be locked into
              </h1>
              <p className="mkt-muted max-w-2xl text-lg">
                We choose widely used technologies so you can hire for them, host
                them anywhere, and hand the code to another team if you ever want
                to. Here is what we use and why.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/contact" className="mkt-btn mkt-btn--primary">
                  Talk to us
                </Link>
                <Link href="/free-audit" className="mkt-btn mkt-btn--secondary">
                  Get a free audit
                </Link>
              </div>
            </div>
            <PageVisual visual={visualForPath("/technologies")} alt="Technology stack" priority />
          </div>
        </div>
      </section>

      {groups.map((g, i) => (
        <section
          key={g.heading}
          className={`mkt-section mkt-section--${i % 2 === 0 ? "light" : "dark"}`}
        >
          <div className="mkt-wrap space-y-8">
            <h2 className="text-3xl font-extrabold">{g.heading}</h2>
            <div className="mkt-grid-3">
              {g.items.map((t) => (
                <Link
                  key={t.slug}
                  href={`/technologies/${t.slug}`}
                  className="mkt-card block"
                >
                  <VisualThumb
                    visual={visualForTechnology(t.slug)}
                    alt={t.name}
                    className="mkt-card-thumb mb-3"
                  />
                  <h3 className="mb-2 text-lg font-bold">{t.name}</h3>
                  <p className="mkt-muted mb-3 text-sm leading-relaxed">
                    {firstSentence(t.whyWeUseIt)}
                  </p>
                  <span className="mkt-link text-sm">Learn more →</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ))}

      <RelatedPages
        tone={groups.length % 2 === 0 ? "light" : "dark"}
        links={[
          { href: "/services", label: "All services" },
          { href: "/ai", label: "AI services" },
          { href: "/process", label: "How we work" },
        ]}
      />
      <SectionCta />
    </>
  );
}

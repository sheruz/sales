import Link from "next/link";
import type { Metadata } from "next";
import { PageBreadcrumb } from "@/components/marketing/page-breadcrumb";
import { PageVisual } from "@/components/marketing/page-visual";
import { RelatedPages } from "@/components/marketing/related-pages";
import { SectionCta } from "@/components/marketing/section-cta";
import { VisualThumb } from "@/components/marketing/visual-thumb";
import { aiPages } from "@/content/pages";
import { buildPageMetadata } from "@/lib/marketing/page-metadata";
import { getNavMeta } from "@/lib/marketing/nav-lookup";
import { visualForAi, visualForPath } from "@/lib/marketing/page-visuals";

export const metadata: Metadata = buildPageMetadata({
  title: "AI Development Services for Business | Delvix Studio",
  description:
    "AI integrations, agents, document processing, chatbots and sales automation built around your real workflows, with your data kept yours.",
  path: "/ai",
});

export default function AiIndexPage() {
  return (
    <>
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <PageBreadcrumb current="AI" currentPath="/ai" />
          <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <p className="mkt-eyebrow">AI services</p>
              <h1 className="max-w-3xl text-4xl font-extrabold sm:text-5xl">
                AI features that do a specific job in your business
              </h1>
              <p className="mkt-muted max-w-2xl text-lg">
                We start with one real workflow, scope an AI feature around it, and
                tell you honestly where AI helps and where it does not. Your data
                stays yours.
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
            <PageVisual visual={visualForPath("/ai")} alt="AI workspace mockup" priority />
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap space-y-8">
          <h2 className="text-3xl font-extrabold">What we build with AI</h2>
          <div className="mkt-grid-3">
            {aiPages.map((p) => {
              const nav = getNavMeta(`/ai/${p.slug}`);
              return (
                <Link key={p.slug} href={`/ai/${p.slug}`} className="mkt-card block">
                  <VisualThumb
                    visual={visualForAi(p.slug)}
                    alt={nav?.title ?? p.h1}
                    className="mkt-card-thumb mb-3"
                  />
                  <h3 className="mb-2 text-lg font-bold">{nav?.title ?? p.h1}</h3>
                  <p className="mkt-muted mb-3 text-sm leading-relaxed">
                    {p.subline}
                  </p>
                  <span className="mkt-link text-sm">Learn more →</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <RelatedPages
        tone="dark"
        links={[
          { href: "/autopilot", label: "Autopilot, our outbound sales platform" },
          { href: "/security", label: "Security and data handling" },
          { href: "/services", label: "All services" },
        ]}
      />
      <SectionCta
        title="Have a workflow in mind for AI?"
        sub="Tell us about it. We will say plainly whether AI is the right tool."
      />
    </>
  );
}

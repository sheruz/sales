import Link from "next/link";
import type { Metadata } from "next";
import { MarketingCard } from "@/components/marketing/marketing-card";
import { PageBreadcrumb } from "@/components/marketing/page-breadcrumb";
import { PageVisual } from "@/components/marketing/page-visual";
import { RelatedPages } from "@/components/marketing/related-pages";
import { SectionCta } from "@/components/marketing/section-cta";
import { industryPages } from "@/content/pages";
import { buildPageMetadata } from "@/lib/marketing/page-metadata";
import { visualForIndustry, visualForPath } from "@/lib/marketing/page-visuals";

export const metadata: Metadata = buildPageMetadata({
  title: "Industries We Build Software For | Delvix Studio",
  description:
    "Custom software for logistics, real estate, healthcare, construction, retail, professional services, education and startups. See how we fit your industry.",
  path: "/industries",
});

export default function IndustriesIndexPage() {
  return (
    <>
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <PageBreadcrumb current="Industries" currentPath="/industries" />
          <div className="mkt-split">
            <div className="space-y-6">
              <p className="mkt-eyebrow">Industries</p>
              <h1 className="max-w-3xl text-4xl font-extrabold text-balance sm:text-5xl">
                Software shaped by how your industry actually works
              </h1>
              <p className="mkt-muted max-w-2xl text-lg">
                Each industry has its own paperwork, timing and habits. Pick yours to
                see the problems we hear most and what we build for them.
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
            <PageVisual
              visual={visualForPath("/industries")}
              alt="Industry operations board"
              priority
            />
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap">
          <div className="mkt-grid-4">
            {industryPages.map((i) => (
              <MarketingCard
                key={i.slug}
                href={`/industries/${i.slug}`}
                title={i.name}
                description={i.subline}
                visual={visualForIndustry(i.slug)}
              />
            ))}
          </div>
        </div>
      </section>

      <RelatedPages
        tone="dark"
        links={[
          { href: "/services", label: "All services" },
          { href: "/work", label: "Our work" },
          { href: "/free-audit", label: "Get a free website audit" },
        ]}
      />
      <SectionCta />
    </>
  );
}

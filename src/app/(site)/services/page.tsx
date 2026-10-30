import Link from "next/link";
import type { Metadata } from "next";
import { MarketingCard } from "@/components/marketing/marketing-card";
import { PageBreadcrumb } from "@/components/marketing/page-breadcrumb";
import { PageVisual } from "@/components/marketing/page-visual";
import { RelatedPages } from "@/components/marketing/related-pages";
import { SectionCta } from "@/components/marketing/section-cta";
import { SectionHeader } from "@/components/marketing/section-header";
import { servicePages } from "@/content/pages";
import { mainNav } from "@/content/navigation";
import { buildPageMetadata } from "@/lib/marketing/page-metadata";
import { getNavMeta } from "@/lib/marketing/nav-lookup";
import { serviceCardTitle } from "@/lib/marketing/card-titles";
import { visualForPath, visualForService } from "@/lib/marketing/page-visuals";

export const metadata: Metadata = buildPageMetadata({
  title: "Software Development Services | Delvix Studio",
  description:
    "Fixed-price projects, dedicated developers, web and mobile apps, ERP, CRM, automation and project rescue. See every way Delvix Studio can help you build.",
  path: "/services",
});

type Card = { slug: string; title: string; short: string };

function buildGroups(): Array<{ heading: string; cards: Card[] }> {
  const bySlug = new Map(servicePages.map((s) => [s.slug, s]));
  const used = new Set<string>();
  const groups: Array<{ heading: string; cards: Card[] }> = [];

  const servicesNav = mainNav.find((t) => t.id === "services");
  for (const section of servicesNav?.sections ?? []) {
    const cards: Card[] = [];
    for (const link of section.links) {
      const match = link.href.match(/^\/services\/([^/?#]+)$/);
      const page = match ? bySlug.get(match[1]) : undefined;
      if (!page || used.has(page.slug)) continue;
      used.add(page.slug);
      cards.push({
        slug: page.slug,
        title: serviceCardTitle(page.slug, link.title),
        short: page.subline,
      });
    }
    if (cards.length > 0) groups.push({ heading: section.heading, cards });
  }

  const rest = servicePages
    .filter((s) => !used.has(s.slug))
    .map((s) => ({
      slug: s.slug,
      title: serviceCardTitle(
        s.slug,
        getNavMeta(`/services/${s.slug}`)?.title ?? s.h1
      ),
      short: s.subline,
    }));
  if (rest.length > 0) groups.push({ heading: "More services", cards: rest });
  return groups;
}

export default function ServicesIndexPage() {
  const groups = buildGroups();

  return (
    <>
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <PageBreadcrumb current="Services" currentPath="/services" />
          <div className="mkt-split">
            <div className="space-y-6">
              <p className="mkt-eyebrow">Services</p>
              <h1 className="max-w-3xl text-4xl font-extrabold text-balance sm:text-5xl">
                Software services for businesses that have outgrown spreadsheets
              </h1>
              <p className="mkt-muted max-w-2xl text-lg">
                Choose how you want to work with us, what you want built, or where
                your project is today.
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
            <PageVisual visual={visualForPath("/services")} alt="Services overview" priority />
          </div>
        </div>
      </section>

      {groups.map((g, i) => (
        <section
          key={g.heading}
          className={`mkt-section mkt-section--${i % 2 === 0 ? "light" : "dark"}`}
        >
          <div className="mkt-wrap space-y-8">
            <SectionHeader eyebrow="Services" title={g.heading} />
            <div className="mkt-grid-3">
              {g.cards.map((c) => (
                <MarketingCard
                  key={c.slug}
                  href={`/services/${c.slug}`}
                  title={c.title}
                  description={c.short}
                  visual={visualForService(c.slug)}
                />
              ))}
            </div>
          </div>
        </section>
      ))}

      <RelatedPages
        tone={groups.length % 2 === 0 ? "light" : "dark"}
        links={[
          { href: "/ai", label: "AI services" },
          { href: "/industries", label: "Industries" },
          { href: "/pricing", label: "Pricing" },
        ]}
      />
      <SectionCta />
    </>
  );
}

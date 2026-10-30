import Link from "next/link";
import type { Metadata } from "next";
import { FaqBlock } from "@/components/marketing/faq-block";
import { PageBreadcrumb } from "@/components/marketing/page-breadcrumb";
import { PageVisual } from "@/components/marketing/page-visual";
import { RelatedPages } from "@/components/marketing/related-pages";
import { SectionCta } from "@/components/marketing/section-cta";
import { pricingPage } from "@/content/pages";
import { siteConfig } from "@/content/site";
import { buildPageMetadata } from "@/lib/marketing/page-metadata";
import { bodyVisualFor, visualForPath } from "@/lib/marketing/page-visuals";

export const metadata: Metadata = buildPageMetadata({
  title: pricingPage.seoTitle,
  description: pricingPage.seoDescription,
  path: "/pricing",
});

function formatFrom(priceFrom?: number, currency?: string) {
  if (priceFrom == null || !Number.isFinite(priceFrom)) return null;
  const cur = currency || "USD";
  try {
    return `from ${new Intl.NumberFormat("en", {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 0,
    }).format(priceFrom)}`;
  } catch {
    return `from $${priceFrom}`;
  }
}

export default function PricingPage() {
  const offers = siteConfig.offers;
  const hasOffers = offers.length > 0;
  const heroVisual = visualForPath("/pricing");
  const bodyVisual = bodyVisualFor(heroVisual, "process-timeline");

  return (
    <>
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <PageBreadcrumb current="Pricing" currentPath="/pricing" />
          <div className="mkt-split">
            <div className="space-y-6">
              <p className="mkt-eyebrow">Pricing</p>
              <h1 className="text-4xl font-extrabold text-balance sm:text-5xl">
                {pricingPage.h1}
              </h1>
              <p className="mkt-muted text-lg leading-relaxed">{pricingPage.intro}</p>
              <p className="mkt-muted text-sm leading-relaxed">
                {pricingPage.noPricesNote}
              </p>
            </div>
            <PageVisual visual={heroVisual} alt="Scoped project milestones" priority />
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap space-y-8">
          <div className="mkt-split">
            <div className="max-w-2xl space-y-3">
              <p className="mkt-eyebrow">Engagement models</p>
              <h2 className="text-3xl font-extrabold text-balance">
                Choose how you want to work
              </h2>
            </div>
            <PageVisual visual={bodyVisual} alt="Delivery process for pricing models" />
          </div>
          <div className="mkt-grid-3">
            {pricingPage.models.map((m) => (
              <div key={m.id} className="mkt-card flex flex-col">
                <h3 className="mb-1 text-xl font-bold">{m.name}</h3>
                <p className="mb-3 text-sm font-medium text-[var(--mkt-accent)]">
                  {m.tagline}
                </p>
                <p className="mkt-muted mb-3 text-sm leading-relaxed">
                  <strong>Best for:</strong> {m.bestFor}
                </p>
                <p className="mb-4 text-sm leading-relaxed">{m.howItWorks}</p>
                <ul className="mb-4 list-disc space-y-1 pl-5 text-sm">
                  {m.includes.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <p className="mkt-muted mb-5 text-sm leading-relaxed">
                  <strong>Trade-offs:</strong> {m.tradeOffs}
                </p>
                <Link
                  href={siteConfig.contact.bookingUrl}
                  className="mkt-link mt-auto text-sm"
                  data-mkt-schedule
                >
                  Talk through this model →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap max-w-3xl space-y-4">
          <p className="mkt-eyebrow">What affects the price</p>
          <h2 className="text-3xl font-extrabold">
            What moves a quote up or down
          </h2>
          <ul className="m-0 list-none space-y-2 p-0">
            {pricingPage.whatAffectsPrice.map((line) => (
              <li key={line} className="mkt-card text-sm leading-relaxed">
                {line}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {hasOffers ? (
        <section className="mkt-section mkt-section--light">
          <div className="mkt-wrap space-y-8">
            <div className="max-w-2xl space-y-3">
              <p className="mkt-eyebrow">Starter offers</p>
              <h2 className="text-3xl font-extrabold">Fixed packages</h2>
              <p className="mkt-muted leading-relaxed">
                {pricingPage.starterOffersNote}
              </p>
            </div>
            <div className="mkt-grid-3">
              {offers.map((o) => {
                const price = formatFrom(o.priceFrom, o.currency);
                return (
                  <div key={o.name} className="mkt-card">
                    <h3 className="mb-2 text-lg font-bold">{o.name}</h3>
                    {price ? (
                      <p className="mb-2 text-[var(--mkt-accent)]">{price}</p>
                    ) : null}
                    {o.days ? (
                      <p className="mkt-muted mb-3 text-sm">{o.days} days</p>
                    ) : null}
                    <p className="mb-4 text-sm leading-relaxed">{o.includes}</p>
                    <Link
                      href={o.href || siteConfig.contact.bookingUrl}
                      className="mkt-link text-sm"
                      data-mkt-schedule={o.href ? undefined : true}
                    >
                      {o.href ? "Learn more →" : "Get started →"}
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      <FaqBlock items={pricingPage.faq} tone={hasOffers ? "dark" : "light"} />
      <RelatedPages
        tone={hasOffers ? "light" : "dark"}
        links={[
          { href: "/process", label: "How we work" },
          { href: "/services/fixed-price-projects", label: "Fixed-price projects" },
          { href: "/free-audit", label: "Get a free website audit" },
        ]}
      />
      <SectionCta
        title="Get a quote for your project"
        sub="Tell us what you need and we will reply with a written scope and price."
      />
    </>
  );
}

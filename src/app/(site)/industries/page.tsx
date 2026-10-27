import Link from "next/link";
import type { Metadata } from "next";
import { SectionCta } from "@/components/marketing/section-cta";
import { industries, siteConfig } from "@/content/site";

export const metadata: Metadata = {
  title: "Industries",
  description:
    "Software for logistics, real estate, clinics, construction, retail and professional services.",
  alternates: { canonical: `${siteConfig.url}/industries` },
};

export default function IndustriesIndexPage() {
  return (
    <>
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <div className="max-w-2xl space-y-3">
            <p className="mkt-eyebrow">Industries</p>
            <h1 className="text-4xl font-extrabold sm:text-5xl">
              Operational businesses
            </h1>
            <p className="mkt-muted text-lg">
              We build for teams that move freight, manage property, run clinics,
              quote jobs, sell stock or deliver expertise — not for pitch-deck
              vaporware.
            </p>
          </div>
          <div className="mkt-grid-3">
            {industries.map((i) => (
              <Link
                key={i.slug}
                href={`/industries/${i.slug}`}
                className="mkt-card block"
              >
                <h2 className="mb-2 text-xl font-bold">{i.name}</h2>
                <p className="mkt-muted mb-2 text-sm font-medium text-[var(--mkt-ink)]">
                  {i.headline}
                </p>
                <p className="mkt-muted mb-4 text-sm">{i.short}</p>
                <span className="mkt-link text-sm">Learn more →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <SectionCta title="Don't see your industry?" sub="If the workflow is operational, tell us — we will say if we are a fit." />
    </>
  );
}

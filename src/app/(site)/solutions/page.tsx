import Link from "next/link";
import type { Metadata } from "next";
import { SectionCta } from "@/components/marketing/section-cta";
import { siteConfig, solutions } from "@/content/site";

export const metadata: Metadata = {
  title: "Solutions",
  description:
    "MVP, SaaS platforms, dedicated teams and discovery — engagement shapes Delvix Studio offers.",
  alternates: { canonical: `${siteConfig.url}/solutions` },
};

export default function SolutionsIndexPage() {
  return (
    <>
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap max-w-3xl space-y-4">
          <p className="mkt-eyebrow">Solutions</p>
          <h1 className="text-4xl font-extrabold sm:text-5xl">
            How the engagement is shaped
          </h1>
          <p className="mkt-muted text-lg">
            Services are what we build. Solutions are how we package the work —
            MVP, platform, dedicated capacity or discovery.
          </p>
        </div>
      </section>
      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap mkt-grid-2">
          {solutions.map((s) => (
            <Link key={s.slug} href={`/solutions/${s.slug}`} className="mkt-card block">
              <h2 className="mb-2 text-2xl font-bold">{s.name}</h2>
              <p className="mkt-muted mb-4 text-sm leading-relaxed">{s.short}</p>
              <span className="mkt-link text-sm">Learn more →</span>
            </Link>
          ))}
        </div>
      </section>
      <SectionCta />
    </>
  );
}

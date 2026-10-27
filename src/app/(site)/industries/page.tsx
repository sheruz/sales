import Link from "next/link";
import type { Metadata } from "next";
import { industries, siteConfig } from "@/content/site";

export const metadata: Metadata = {
  title: "Industries",
  description: "Software for logistics, real estate, clinics, construction, retail and professional services.",
  alternates: { canonical: `${siteConfig.url}/industries` },
};

export default function IndustriesIndexPage() {
  return (
    <section className="mkt-section mkt-section--dark">
      <div className="mkt-wrap space-y-8">
        <div className="max-w-2xl space-y-3">
          <p className="mkt-eyebrow">Industries</p>
          <h1 className="text-4xl font-extrabold sm:text-5xl">
            Operational businesses
          </h1>
        </div>
        <div className="mkt-grid-3">
          {industries.map((i) => (
            <Link key={i.slug} href={`/industries/${i.slug}`} className="mkt-card block">
              <h2 className="mb-2 text-xl font-bold">{i.name}</h2>
              <p className="mkt-muted mb-4 text-sm">{i.short}</p>
              <span className="mkt-link text-sm">Learn more →</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

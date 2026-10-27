import Link from "next/link";
import type { Metadata } from "next";
import { SectionCta } from "@/components/marketing/section-cta";
import { services, siteConfig, solutions } from "@/content/site";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Web apps, mobile apps, custom ERP & CRM, AI integrations, automation and project rescue from Delvix Studio.",
  alternates: { canonical: `${siteConfig.url}/services` },
};

export default function ServicesIndexPage() {
  return (
    <>
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <div className="max-w-2xl space-y-3">
            <p className="mkt-eyebrow">Services</p>
            <h1 className="text-4xl font-extrabold sm:text-5xl">What we build</h1>
            <p className="mkt-muted text-lg">
              Six focused lines. Fixed written scope before build. Weekly demos.
              You own the code.
            </p>
          </div>
          <div className="mkt-grid-3">
            {services.map((s) => (
              <Link
                key={s.slug}
                href={`/services/${s.slug}`}
                className="mkt-card block"
              >
                <h2 className="mb-2 text-xl font-bold">{s.name}</h2>
                <p className="mkt-muted mb-3 text-sm leading-relaxed">{s.headline}</p>
                <p className="mkt-muted mb-4 text-sm">{s.short}</p>
                <span className="mkt-link text-sm">Learn more →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap space-y-6">
          <div className="max-w-2xl space-y-3">
            <p className="mkt-eyebrow">Also see</p>
            <h2 className="text-3xl font-extrabold">Solutions</h2>
            <p className="mkt-muted">
              How we package the work — MVP, SaaS, dedicated team or discovery.
            </p>
          </div>
          <div className="mkt-grid-2">
            {solutions.map((s) => (
              <Link
                key={s.slug}
                href={`/solutions/${s.slug}`}
                className="mkt-card block"
              >
                <h3 className="mb-2 font-bold">{s.name}</h3>
                <p className="mkt-muted mb-3 text-sm">{s.short}</p>
                <span className="mkt-link text-sm">Open →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <SectionCta />
    </>
  );
}

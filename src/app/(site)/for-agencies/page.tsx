import Link from "next/link";
import type { Metadata } from "next";
import { PageVisual } from "@/components/marketing/page-visual";
import { SectionCta } from "@/components/marketing/section-cta";
import { forAgenciesPage, siteConfig } from "@/content/site";
import { visualForPath } from "@/lib/marketing/page-visuals";

export const metadata: Metadata = {
  title: "For agencies",
  description:
    "Delvix Studio builds for your clients. Delvix Autopilot helps agencies find and qualify their own.",
  alternates: { canonical: `${siteConfig.url}/for-agencies` },
};

export default function ForAgenciesPage() {
  return (
    <>
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <p className="mkt-eyebrow">For agencies</p>
              <h1 className="text-4xl font-extrabold sm:text-5xl">
                {forAgenciesPage.headline}
              </h1>
              <p className="mkt-muted text-lg">{forAgenciesPage.intro}</p>
            </div>
            <PageVisual visual={visualForPath("/for-agencies")} alt="Agency partner workspace" priority />
          </div>
        </div>
      </section>
      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap grid gap-8 lg:grid-cols-2">
          <div className="mkt-card space-y-4">
            <p className="mkt-eyebrow">Studio</p>
            <h2 className="text-2xl font-bold">Build for your clients</h2>
            <ul className="space-y-2 text-sm">
              {forAgenciesPage.studio.map((line) => (
                <li key={line}>· {line}</li>
              ))}
            </ul>
            <Link href="/services" className="mkt-link text-sm">
              Browse services →
            </Link>
          </div>
          <div className="mkt-card space-y-4">
            <p className="mkt-eyebrow">Product</p>
            <h2 className="text-2xl font-bold">Grow your own pipeline</h2>
            <ul className="space-y-2 text-sm">
              {forAgenciesPage.autopilot.map((line) => (
                <li key={line}>· {line}</li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3">
              <Link href="/autopilot" className="mkt-link text-sm">
                Autopilot →
              </Link>
              <Link href="/work/revenue-os" className="mkt-link text-sm">
                How we built it →
              </Link>
            </div>
          </div>
        </div>
      </section>
      <SectionCta title="Agency or studio partner? Let's talk." />
    </>
  );
}

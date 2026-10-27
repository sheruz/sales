import Link from "next/link";
import type { Metadata } from "next";
import { SectionCta } from "@/components/marketing/section-cta";
import {
  engagementModels,
  processPage,
  processSteps,
  siteConfig,
} from "@/content/site";

export const metadata: Metadata = {
  title: "Process",
  description:
    "How Delvix Studio runs engagements: discovery, written scope in 3 days, weekly demos, launch and support.",
  alternates: { canonical: `${siteConfig.url}/process` },
};

export default function ProcessPage() {
  return (
    <>
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap max-w-3xl space-y-4">
          <p className="mkt-eyebrow">Process</p>
          <h1 className="text-4xl font-extrabold sm:text-5xl">
            {processPage.headline}
          </h1>
          <p className="mkt-muted text-lg">{processPage.intro}</p>
        </div>
      </section>

      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap space-y-8">
          <p className="mkt-eyebrow">Six steps</p>
          <ol className="mkt-grid-3 list-none p-0">
            {processSteps.map((step) => (
              <li key={step.n} className="mkt-card">
                <p className="mb-3 font-mono text-sm text-[var(--mkt-accent)]">
                  {step.n}
                </p>
                <h2 className="mb-2 text-xl font-bold">{step.title}</h2>
                <p className="mkt-muted text-sm leading-relaxed">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <p className="mkt-eyebrow">Principles</p>
          <div className="mkt-grid-3">
            {processPage.principles.map((p) => (
              <div key={p.title} className="mkt-card">
                <h3 className="mb-2 text-lg font-bold">{p.title}</h3>
                <p className="mkt-muted text-sm leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap space-y-8">
          <div className="max-w-2xl space-y-3">
            <p className="mkt-eyebrow">Engagement</p>
            <h2 className="text-3xl font-extrabold">How teams hire us</h2>
          </div>
          <div className="mkt-grid-3">
            {engagementModels.map((m) => (
              <div key={m.name} className="mkt-card">
                <h3 className="mb-2 text-lg font-bold">{m.name}</h3>
                <p className="mkt-muted mb-3 text-sm">Fits: {m.fits}</p>
                <ul className="mb-4 space-y-1 text-sm">
                  {m.includes.map((line) => (
                    <li key={line}>· {line}</li>
                  ))}
                </ul>
                <Link href="/pricing" className="mkt-link text-sm">
                  Pricing →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SectionCta title="Ready for a discovery call?" />
    </>
  );
}

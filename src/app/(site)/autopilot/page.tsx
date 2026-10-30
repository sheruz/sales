import Link from "next/link";
import type { Metadata } from "next";
import { ProductShot } from "@/components/marketing/product-shot";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import { siteConfig } from "@/content/site";

export const metadata: Metadata = {
  title: "Delvix Autopilot",
  description:
    "Early access client-acquisition platform for agencies: find businesses, audit sites, personalize outreach and track the pipeline.",
  alternates: { canonical: `${siteConfig.url}/autopilot` },
};

const stages = [
  "Find businesses",
  "Crawl & enrich",
  "Deep website audit",
  "Personalized outreach",
  "Reply agent",
  "Pipeline",
] as const;

export default function AutopilotPage() {
  return (
    <>
      <section className="mkt-section mkt-section--dark relative overflow-hidden">
        <div className="mkt-glow left-1/2 top-0 -translate-x-1/2" aria-hidden />
        <div className="mkt-wrap relative z-[1] grid items-center gap-10 lg:grid-cols-2">
          <div className="space-y-5">
            <p className="mkt-eyebrow">Product · Early access</p>
            <h1 className="text-4xl font-extrabold sm:text-5xl">
              Delvix Autopilot finds the clients. You take the call.
            </h1>
            <p className="mkt-muted text-lg">
              Our own acquisition platform — separate from studio services.
              Built for agencies and freelancers who want a system, not another
              spreadsheet.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="#waitlist" className="mkt-btn mkt-btn--primary">
                Request early access
              </Link>
              <Link href="/work/revenue-os" className="mkt-btn mkt-btn--secondary">
                How we built it
              </Link>
            </div>
          </div>
          <ProductShot
            name="revenue-os-dashboard"
            alt="Autopilot dashboard"
            priority
            hero
          />
        </div>
      </section>

      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap space-y-8">
          <div className="max-w-2xl space-y-3">
            <p className="mkt-eyebrow">How it runs</p>
            <h2 className="text-3xl font-extrabold text-balance">
              Six stages, one pipeline
            </h2>
          </div>
          <ol className="mkt-grid-3 list-none p-0">
            {stages.map((label, i) => (
              <li key={label} className="mkt-card flex h-full flex-col">
                <p className="mkt-step-num mb-2">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="text-lg font-semibold">{label}</h3>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap mkt-split">
          <div className="space-y-4">
            <p className="mkt-eyebrow">Evidence, not guesses</p>
            <h2 className="text-3xl font-extrabold text-balance">
              Deep audits with screenshots and findings
            </h2>
            <p className="mkt-muted leading-relaxed">
              Headless browser, desktop and mobile captures, severity-ranked
              issues. Outreach references what is actually on the site.
            </p>
          </div>
          <ProductShot
            name="revenue-os-deep-audit"
            alt="Deep audit findings"
          />
        </div>
      </section>

      <section className="mkt-section mkt-section--light" id="waitlist">
        <div className="mkt-wrap max-w-2xl space-y-6">
          <div className="space-y-3">
            <p className="mkt-eyebrow">Early access</p>
            <h2 className="text-3xl font-extrabold">Request a spot</h2>
            <p className="mkt-muted">
              Small group of agencies and freelancers. We reply by email when a
              seat opens.
            </p>
          </div>
          <WaitlistForm />
        </div>
      </section>
    </>
  );
}

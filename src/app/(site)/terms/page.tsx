import Link from "next/link";
import type { Metadata } from "next";
import { siteConfig } from "@/content/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms for Delvix Studio website services and the Delvix product.",
  alternates: { canonical: `${siteConfig.url}/terms` },
};

export default function TermsPage() {
  const updated = "2026-04-27";

  return (
    <section className="mkt-section mkt-section--dark">
      <article className="mkt-wrap max-w-3xl space-y-6 text-sm leading-relaxed">
        <div className="space-y-3">
          <p className="mkt-eyebrow">Legal</p>
          <h1 className="text-4xl font-extrabold">Terms of Service</h1>
          <p className="mkt-muted">Last updated: {updated}</p>
        </div>

        <h2 className="text-xl font-bold pt-2">Studio engagements</h2>
        <p>
          Custom software work is governed by a written scope or statement of
          work you approve before build. Fixed-price work covers that scope;
          changes are written and priced separately. You own the deliverables
          described in the agreement upon payment of amounts due.
        </p>

        <h2 className="text-xl font-bold pt-2">Website use</h2>
        <p>
          Do not abuse forms, scrape the site or attempt unauthorized access.
          Content on this marketing site is informational and not a binding offer
          until a signed agreement exists.
        </p>

        <h2 className="text-xl font-bold pt-2">Product accounts</h2>
        <p>
          By creating a Delvix account you agree to use the platform lawfully,
          respect recipient consent for outreach, and keep API keys and OAuth
          credentials confidential.
        </p>
        <p>
          High-risk outbound and campaign actions require human approval where
          the product enforces it. You remain responsible for approved actions
          and for complying with email and advertising rules in your
          jurisdictions.
        </p>
        <p>
          Billing follows your selected plan and payment provider terms when
          enabled.
        </p>

        <p>
          See our{" "}
          <Link href="/privacy" className="mkt-link">
            Privacy Policy
          </Link>
          . Questions:{" "}
          <a className="mkt-link" href={`mailto:${siteConfig.contact.email}`}>
            {siteConfig.contact.email}
          </a>
          .
        </p>
      </article>
    </section>
  );
}

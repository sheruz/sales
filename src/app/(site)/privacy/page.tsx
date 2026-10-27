import Link from "next/link";
import type { Metadata } from "next";
import { siteConfig } from "@/content/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Delvix Studio handles website, product and advertising lead data.",
  alternates: { canonical: `${siteConfig.url}/privacy` },
};

export default function PrivacyPage() {
  const updated = "2026-04-27";

  return (
    <section className="mkt-section mkt-section--dark">
      <article className="mkt-wrap max-w-3xl space-y-6 text-sm leading-relaxed">
        <div className="space-y-3">
          <p className="mkt-eyebrow">Legal</p>
          <h1 className="text-4xl font-extrabold">Privacy Policy</h1>
          <p className="mkt-muted">Last updated: {updated}</p>
        </div>

        <p>
          This policy covers the Delvix Studio marketing website (
          {siteConfig.url}), contact and audit forms, Meta Lead Ads and similar
          advertising lead forms, and the Delvix product (accounts, CRM,
          outreach and Autopilot) when you use it.
        </p>

        <h2 className="text-xl font-bold pt-2">Who we are</h2>
        <p>
          {siteConfig.legalName}. Contact:{" "}
          <a className="mkt-link" href={`mailto:${siteConfig.contact.email}`}>
            {siteConfig.contact.email}
          </a>
          .
        </p>

        <h2 className="text-xl font-bold pt-2">Website and ad leads</h2>
        <p>
          When you submit a contact form, free audit request, Autopilot waitlist
          form, or a Meta Lead Ad (or similar) form, we collect the fields you
          provide — typically name, email, company, website, message and the
          problem you selected. We use that data to reply, qualify the request
          and, where relevant, create a lead in our CRM. We do not sell these
          leads.
        </p>
        <p>
          Forms may include a honeypot field to block bots. We may store IP-based
          rate-limit signals briefly to prevent abuse.
        </p>

        <h2 className="text-xl font-bold pt-2">Advertising and analytics</h2>
        <p>
          If a Meta Pixel ID is configured in our Super Admin settings, the Pixel
          may load on marketing pages only (not inside logged-in app areas such as
          /dashboard or /platform). It can record PageView, Lead (form submit)
          and Schedule (booking click) events. You can control ads cookies via
          your browser and Meta settings.
        </p>

        <h2 className="text-xl font-bold pt-2">Product data</h2>
        <p>
          For the Delvix application we process account, organization, CRM,
          email and usage data to operate the product for your company. Data is
          scoped to your organization and is not shared across tenants.
        </p>
        <p>
          Organization administrators may request export or deletion via Settings
          / Privacy APIs (<code>/api/privacy/data</code>).
        </p>
        <p>
          Email outreach respects unsubscribe, suppression, bounce and complaint
          signals. AI features treat external content as untrusted data and do
          not use your data to train third-party foundation models through this
          application layer (provider policies may apply to BYOK keys).
        </p>

        <h2 className="text-xl font-bold pt-2">Retention and contact</h2>
        <p>
          Marketing leads are kept while useful for the sales conversation and
          then archived or deleted on request. Product data retention follows
          your workspace settings and applicable law.
        </p>
        <p>
          Privacy requests:{" "}
          <a className="mkt-link" href={`mailto:${siteConfig.contact.email}`}>
            {siteConfig.contact.email}
          </a>
          . See also{" "}
          <Link href="/terms" className="mkt-link">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/cookies" className="mkt-link">
            Cookies
          </Link>
          .
        </p>
      </article>
    </section>
  );
}

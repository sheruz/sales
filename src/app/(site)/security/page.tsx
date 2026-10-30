import type { Metadata } from "next";
import { FaqBlock } from "@/components/marketing/faq-block";
import { PageBreadcrumb } from "@/components/marketing/page-breadcrumb";
import { PageVisual } from "@/components/marketing/page-visual";
import { RelatedPages } from "@/components/marketing/related-pages";
import { SectionCta } from "@/components/marketing/section-cta";
import { securityPageDetailed } from "@/content/pages";
import { buildPageMetadata } from "@/lib/marketing/page-metadata";
import { bodyVisualFor, visualForPath } from "@/lib/marketing/page-visuals";

export const metadata: Metadata = buildPageMetadata({
  title: securityPageDetailed.seoTitle,
  description: securityPageDetailed.seoDescription,
  path: "/security",
});

export default function SecurityPage() {
  const page = securityPageDetailed;
  const heroVisual = visualForPath("/security");
  const bodyVisual = bodyVisualFor(heroVisual, "code-stack");

  return (
    <>
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <PageBreadcrumb current="Security" currentPath="/security" />
          <div className="mkt-split">
            <div className="space-y-6">
              <p className="mkt-eyebrow">Security</p>
              <h1 className="text-4xl font-extrabold text-balance sm:text-5xl">
                {page.h1}
              </h1>
              <p className="mkt-muted text-lg leading-relaxed">{page.intro}</p>
            </div>
            <PageVisual visual={heroVisual} alt="Secure stack overview" priority />
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap space-y-8">
          <div className="mkt-split">
            <div className="max-w-2xl space-y-3">
              <p className="mkt-eyebrow">Our commitments</p>
              <h2 className="text-3xl font-extrabold text-balance">
                How we handle your data
              </h2>
            </div>
            <PageVisual visual={bodyVisual} alt="Stack and hosting overview" />
          </div>
          <div className="mkt-grid-2">
            {page.commitments.map((c) => (
              <div key={c.title} className="mkt-card">
                <h3 className="mb-2 text-lg font-bold">{c.title}</h3>
                <p className="mkt-muted text-sm leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap grid gap-10 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="mkt-eyebrow">Honest note</p>
            <h2 className="text-2xl font-bold">{page.honestyNote.title}</h2>
            <p className="leading-relaxed">{page.honestyNote.body}</p>
          </div>
          <div className="space-y-3">
            <p className="mkt-eyebrow">Your side</p>
            <h2 className="text-2xl font-bold">What we ask of you</h2>
            <ul className="m-0 list-none space-y-2 p-0">
              {page.yourResponsibilities.map((line) => (
                <li key={line} className="mkt-card text-sm leading-relaxed">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <FaqBlock items={page.faq} tone="light" />
      <RelatedPages
        tone="dark"
        links={[
          { href: "/about", label: "About Delvix Studio" },
          { href: "/ai", label: "AI services and your data" },
          { href: "/contact", label: "Ask us a security question" },
        ]}
      />
      <SectionCta
        title="Have security or compliance requirements?"
        sub="Tell us up front and we will say honestly whether we can meet them."
      />
    </>
  );
}

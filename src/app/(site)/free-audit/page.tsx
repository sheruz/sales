import type { Metadata } from "next";
import { AuditForm } from "@/components/marketing/audit-form";
import { FaqBlock } from "@/components/marketing/faq-block";
import { PageBreadcrumb } from "@/components/marketing/page-breadcrumb";
import { RelatedPages } from "@/components/marketing/related-pages";
import { SectionCta } from "@/components/marketing/section-cta";
import { freeAuditPage } from "@/content/pages";
import { buildPageMetadata } from "@/lib/marketing/page-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: freeAuditPage.seoTitle,
  description: freeAuditPage.seoDescription,
  path: "/free-audit",
});

export default function FreeAuditPage() {
  const page = freeAuditPage;

  return (
    <>
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <PageBreadcrumb current="Free audit" currentPath="/free-audit" />
          <div className="mkt-split">
            <div className="space-y-5">
              <p className="mkt-eyebrow">Free audit</p>
              <h1 className="text-4xl font-extrabold text-balance sm:text-5xl">
                {page.h1}
              </h1>
              <p className="mkt-muted text-lg leading-relaxed">{page.intro}</p>
              <p className="mkt-muted text-sm leading-relaxed">{page.honestNote}</p>
              <div>
                <p className="mb-2 text-sm font-semibold">What we check</p>
                <ul className="m-0 list-none space-y-2 p-0 text-sm">
                  {page.whatWeCheck.map((c) => (
                    <li key={c.title} className="flex gap-2">
                      <span className="text-[var(--mkt-accent)]" aria-hidden>
                        ✓
                      </span>
                      <span>
                        <strong>{c.title}.</strong> {c.body}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div id="request">
              <h2 className="mb-4 text-2xl font-bold">{page.form.title}</h2>
              <AuditForm />
            </div>
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap mkt-split">
          <div className="space-y-4">
            <p className="mkt-eyebrow">The report</p>
            <h2 className="text-3xl font-extrabold text-balance">
              {page.reportDescription.title}
            </h2>
            <p className="leading-relaxed">{page.reportDescription.body}</p>
            <ul className="m-0 list-disc space-y-1 pl-5 text-sm">
              {page.reportDescription.includes.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-4">
            <p className="mkt-eyebrow">How it works</p>
            <h2 className="text-3xl font-extrabold text-balance">
              From request to report
            </h2>
            <ol className="m-0 list-none space-y-3 p-0">
              {page.howItWorks.map((s, i) => (
                <li key={s} className="mkt-card flex gap-3 text-sm leading-relaxed">
                  <span className="font-mono text-[var(--mkt-accent)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <FaqBlock items={page.faq} tone="dark" />
      <RelatedPages
        tone="light"
        links={[
          { href: "/services/website-development", label: "Website development" },
          { href: "/process", label: "How we work" },
          { href: "/contact", label: "Talk to us instead" },
        ]}
      />
      <SectionCta
        showAuditLink={false}
        title="Prefer to talk it through?"
        sub="Book a short call and we will look at your site together."
      />
    </>
  );
}

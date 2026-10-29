import type { Metadata } from "next";
import { PageVisual } from "@/components/marketing/page-visual";
import { SectionCta } from "@/components/marketing/section-cta";
import { faq, siteConfig } from "@/content/site";
import { visualForPath } from "@/lib/marketing/page-visuals";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Pricing, ownership, timezones, NDAs, demos and support — answers from Delvix Studio.",
  alternates: { canonical: `${siteConfig.url}/faq` },
};

export default function FaqPage() {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <p className="mkt-eyebrow">FAQ</p>
              <h1 className="text-4xl font-extrabold sm:text-5xl">
                Common questions
              </h1>
              <p className="mkt-muted text-lg">
                Straight answers. If yours is missing, book a call and ask.
              </p>
            </div>
            <PageVisual visual={visualForPath("/faq")} alt="FAQ overview" priority />
          </div>
        </div>
      </section>
      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap max-w-3xl space-y-3">
          {faq.map((f) => (
            <details key={f.q} className="mkt-card">
              <summary className="cursor-pointer font-semibold">{f.q}</summary>
              <p className="mkt-muted mt-3 text-sm leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
      <SectionCta />
    </>
  );
}

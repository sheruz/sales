import type { Metadata } from "next";
import { SectionCta } from "@/components/marketing/section-cta";
import { securityPage, siteConfig } from "@/content/site";

export const metadata: Metadata = {
  title: "Security",
  description:
    "How Delvix Studio handles tenant isolation, secrets, auth and handover on client builds.",
  alternates: { canonical: `${siteConfig.url}/security` },
};

export default function SecurityPage() {
  return (
    <>
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap max-w-3xl space-y-4">
          <p className="mkt-eyebrow">Security</p>
          <h1 className="text-4xl font-extrabold sm:text-5xl">
            {securityPage.headline}
          </h1>
          <p className="mkt-muted text-lg">{securityPage.intro}</p>
        </div>
      </section>
      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap mkt-grid-2">
          {securityPage.practices.map((p) => (
            <div key={p.title} className="mkt-card">
              <h2 className="mb-2 text-xl font-bold">{p.title}</h2>
              <p className="mkt-muted text-sm leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap max-w-3xl space-y-4">
          <p className="mkt-eyebrow">FAQ</p>
          {securityPage.faq.map((f) => (
            <details key={f.q} className="mkt-card">
              <summary className="cursor-pointer font-semibold">{f.q}</summary>
              <p className="mkt-muted mt-3 text-sm">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
      <SectionCta title="Need security notes in your scope?" />
    </>
  );
}

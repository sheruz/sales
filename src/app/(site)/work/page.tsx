import Link from "next/link";
import type { Metadata } from "next";
import { siteConfig, verifiedCaseStudies } from "@/content/site";

export const metadata: Metadata = {
  title: "Work",
  description: "Verified case studies from Delvix Studio.",
  alternates: { canonical: `${siteConfig.url}/work` },
};

export default function WorkIndexPage() {
  const cases = verifiedCaseStudies();

  return (
    <section className="mkt-section mkt-section--dark">
      <div className="mkt-wrap space-y-8">
        <div className="max-w-2xl space-y-3">
          <p className="mkt-eyebrow">Work</p>
          <h1 className="text-4xl font-extrabold sm:text-5xl">Case studies</h1>
          <p className="mkt-muted text-lg">
            Only verified engagements appear here. No filler logos or invented results.
          </p>
        </div>
        {cases.length === 0 ? (
          <p className="mkt-muted">Case studies will appear here when published.</p>
        ) : (
          <div className="mkt-grid-2">
            {cases.map((c) => (
              <Link key={c.slug} href={`/work/${c.slug}`} className="mkt-card block">
                {c.featured ? (
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--mkt-accent)]">
                    Featured
                  </p>
                ) : null}
                <h2 className="mb-2 text-2xl font-bold">{c.title}</h2>
                <p className="mkt-muted mb-3 text-sm">{c.clientType}</p>
                <p className="mb-4 text-sm leading-relaxed line-clamp-3">{c.problem}</p>
                <span className="mkt-link text-sm">Read →</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

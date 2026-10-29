import Link from "next/link";
import type { Metadata } from "next";
import Image from "next/image";
import { PageVisual } from "@/components/marketing/page-visual";
import { siteConfig, verifiedCaseStudies } from "@/content/site";
import { illustrationSrc } from "@/lib/marketing/page-visuals";

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
        <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="max-w-2xl space-y-3">
            <p className="mkt-eyebrow">Work</p>
            <h1 className="text-4xl font-extrabold sm:text-5xl">Case studies</h1>
            <p className="mkt-muted text-lg">
              Only verified engagements appear here. No filler logos or invented results.
            </p>
          </div>
          <PageVisual visual="web-dashboard" alt="Product work sample" priority />
        </div>
        {cases.length === 0 ? (
          <p className="mkt-muted">Case studies will appear here when published.</p>
        ) : (
          <div className="mkt-grid-2">
            {cases.map((c) => {
              const thumb =
                c.screenshots[0]?.src ?? illustrationSrc("web-dashboard");
              return (
                <Link key={c.slug} href={`/work/${c.slug}`} className="mkt-card block">
                  <div className="relative mb-3 aspect-video overflow-hidden rounded-xl border border-[var(--mkt-line)] bg-[#0a0f1a]">
                    <Image
                      src={thumb}
                      alt={c.title}
                      fill
                      className="object-cover object-top"
                      sizes="(max-width: 768px) 100vw, 480px"
                      unoptimized
                    />
                  </div>
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
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

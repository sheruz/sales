import Link from "next/link";
import type { Metadata } from "next";
import { PageVisual } from "@/components/marketing/page-visual";
import { SectionCta } from "@/components/marketing/section-cta";
import { VisualThumb } from "@/components/marketing/visual-thumb";
import { siteConfig, solutions } from "@/content/site";
import { visualForPath, visualForSolution } from "@/lib/marketing/page-visuals";

export const metadata: Metadata = {
  title: "Solutions",
  description:
    "MVP, SaaS platforms, dedicated teams and discovery — engagement shapes Delvix Studio offers.",
  alternates: { canonical: `${siteConfig.url}/solutions` },
};

export default function SolutionsIndexPage() {
  return (
    <>
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <p className="mkt-eyebrow">Solutions</p>
              <h1 className="text-4xl font-extrabold sm:text-5xl">
                How the engagement is shaped
              </h1>
              <p className="mkt-muted text-lg">
                Services are what we build. Solutions are how we package the work.
                Every card below expands to a full page with problem, approach,
                capabilities, use cases, deliverables and FAQ.
              </p>
            </div>
            <PageVisual visual={visualForPath("/solutions")} alt="Solutions overview" priority />
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap space-y-10">
          {solutions.map((s) => (
            <article
              key={s.slug}
              className="mkt-card grid gap-6 lg:grid-cols-[1.1fr_0.9fr]"
            >
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--mkt-accent)]">
                  /solutions/{s.slug}
                </p>
                <h2 className="text-2xl font-extrabold sm:text-3xl">{s.name}</h2>
                <p className="text-lg font-medium text-[var(--mkt-ink)]">
                  {s.headline}
                </p>
                <p className="mkt-muted text-sm leading-relaxed">{s.short}</p>
                <p className="text-sm leading-relaxed text-[var(--mkt-ink)]">
                  {s.approach}
                </p>
                <ul className="space-y-1 text-sm">
                  {s.includes.map((line) => (
                    <li key={line} className="mkt-muted">
                      · {line}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/solutions/${s.slug}`}
                  className="mkt-btn mkt-btn--primary inline-flex"
                >
                  Open full page →
                </Link>
              </div>
              <div className="space-y-4">
                <VisualThumb
                  visual={visualForSolution(s.slug)}
                  alt={s.name}
                  aspect="wide"
                />
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--mkt-accent)]">
                  On the inner page
                </p>
                <ul className="space-y-2">
                  {s.capabilities.map((c) => (
                    <li
                      key={c.title}
                      className="rounded-xl border border-[var(--mkt-line)] bg-white/80 px-3 py-2"
                    >
                      <p className="text-sm font-semibold text-[var(--mkt-ink)]">
                        {c.title}
                      </p>
                      <p className="mkt-muted mt-0.5 text-xs leading-snug">
                        {c.body}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>
      <SectionCta />
    </>
  );
}

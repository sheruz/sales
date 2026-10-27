import Link from "next/link";
import type { Metadata } from "next";
import { SectionCta } from "@/components/marketing/section-cta";
import { siteConfig, techStack, technologies } from "@/content/site";

export const metadata: Metadata = {
  title: "Technologies",
  description:
    "Next.js, React, Node, PostgreSQL, React Native, Flutter, Python, AWS, OpenAI, Anthropic — stacks Delvix ships with.",
  alternates: { canonical: `${siteConfig.url}/technologies` },
};

export default function TechnologiesPage() {
  return (
    <>
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap max-w-3xl space-y-4">
          <p className="mkt-eyebrow">Technologies</p>
          <h1 className="text-4xl font-extrabold sm:text-5xl">
            Stacks we ship with
          </h1>
          <p className="mkt-muted text-lg">
            Text badges only — no rented logo walls. We pick tools that fit the
            scope, not a marketing checklist.
          </p>
        </div>
      </section>

      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap space-y-8">
          {Object.entries(techStack).map(([group, items]) => (
            <div key={group}>
              <p className="mb-3 text-sm font-semibold text-[var(--mkt-ink)]">
                {group}
              </p>
              <div className="flex flex-wrap gap-2">
                {items.map((item) => {
                  const tech = technologies.find(
                    (t) => t.name === item || t.name.replace(".js", "") === item.replace(".js", "")
                  );
                  return tech ? (
                    <Link key={item} href={`/technologies/${tech.slug}`} className="mkt-badge">
                      {item}
                    </Link>
                  ) : (
                    <span key={item} className="mkt-badge">
                      {item}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap mkt-grid-2">
          {technologies.map((t) => (
            <Link key={t.slug} href={`/technologies/${t.slug}`} className="mkt-card block">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--mkt-accent)]">
                {t.group}
              </p>
              <h2 className="mb-2 text-xl font-bold">{t.name}</h2>
              <p className="mkt-muted mb-3 text-sm">{t.short}</p>
              <span className="mkt-link text-sm">Details →</span>
            </Link>
          ))}
        </div>
      </section>
      <SectionCta title="Not sure which stack fits?" />
    </>
  );
}

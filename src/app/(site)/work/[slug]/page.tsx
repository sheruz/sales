import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrowserFrame } from "@/components/marketing/browser-frame";
import {
  caseStudies,
  getCaseStudy,
  siteConfig,
} from "@/content/site";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return caseStudies.filter((c) => c.verified).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = getCaseStudy(slug);
  if (!c?.verified) return {};
  return {
    title: c.title,
    description: c.problem.slice(0, 155),
    alternates: { canonical: `${siteConfig.url}/work/${c.slug}` },
  };
}

export default async function CaseStudyPage({ params }: Props) {
  const { slug } = await params;
  const c = getCaseStudy(slug);
  if (!c?.verified) notFound();

  return (
    <>
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <p className="mkt-eyebrow">Case study</p>
              <h1 className="text-4xl font-extrabold sm:text-5xl">{c.title}</h1>
              <p className="text-[var(--mkt-accent)]">{c.clientType}</p>
              <p className="mkt-muted">{c.status}</p>
            </div>
            {c.screenshots[0] ? (
              <BrowserFrame
                src={c.screenshots[0].src}
                alt={c.screenshots[0].alt.replace(/\s*placeholder\s*/gi, " ").trim()}
                priority
              />
            ) : null}
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap grid gap-10 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="mkt-eyebrow">Problem</p>
            <p className="leading-relaxed text-[var(--mkt-ink)]">{c.problem}</p>
          </div>
          <div className="space-y-3">
            <p className="mkt-eyebrow">What we built</p>
            <ul className="space-y-2">
              {c.whatWeBuilt.map((item) => (
                <li key={item} className="text-sm leading-relaxed text-[var(--mkt-ink)]">
                  · {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {c.platformFeatures && c.platformFeatures.length > 0 ? (
        <section className="mkt-section mkt-section--dark">
          <div className="mkt-wrap space-y-6">
            <p className="mkt-eyebrow">Platform features</p>
            <ul className="mkt-grid-2">
              {c.platformFeatures.map((f) => (
                <li key={f} className="mkt-card text-sm">
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {c.security && c.security.length > 0 ? (
        <section className="mkt-section mkt-section--light">
          <div className="mkt-wrap max-w-3xl space-y-4">
            <p className="mkt-eyebrow">Security</p>
            <ul className="space-y-2">
              {c.security.map((n) => (
                <li key={n} className="text-sm text-[var(--mkt-ink)]">
                  · {n}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {c.results.length > 0 ? (
        <section className="mkt-section mkt-section--dark">
          <div className="mkt-wrap max-w-3xl space-y-4">
            <p className="mkt-eyebrow">Results</p>
            <ul className="space-y-2">
              {c.results.map((r) => (
                <li key={r} className="mkt-card text-sm">
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-6">
          <p className="mkt-eyebrow">Stack</p>
          <div className="flex flex-wrap gap-2">
            {c.stack.map((s) => (
              <span key={s} className="mkt-badge">
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {c.screenshots.length > 0 ? (
        <section className="mkt-section mkt-section--light">
          <div className="mkt-wrap space-y-8">
            <p className="mkt-eyebrow">Screenshots</p>
            <div className="mkt-grid-2">
              {c.screenshots.map((shot) => (
                <figure key={shot.src} className="space-y-2">
                  <BrowserFrame
                    src={shot.src}
                    alt={shot.alt.replace(/\s*placeholder\s*/gi, " ").trim()}
                  />
                  <figcaption className="text-sm text-[var(--mkt-ink-muted)]">
                    {shot.label}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="mkt-section mkt-section--cta">
        <div className="mkt-wrap flex flex-wrap justify-center gap-3">
          <Link
            href={siteConfig.contact.bookingUrl}
            className="mkt-btn mkt-btn--primary"
            data-mkt-schedule
          >
            Need a platform like this? Book a free call
          </Link>
          <Link href="/autopilot" className="mkt-btn mkt-btn--secondary">
            Request Autopilot early access
          </Link>
        </div>
      </section>
    </>
  );
}

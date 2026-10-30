import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductShot } from "@/components/marketing/product-shot";
import { BrowserFrame } from "@/components/marketing/browser-frame";
import {
  caseStudies,
  getCaseStudy,
  siteConfig,
} from "@/content/site";
import type { ProductShotName } from "@/lib/marketing/product-shots";

type Props = { params: Promise<{ slug: string }> };

const SHOT_BY_LABEL: Record<string, ProductShotName> = {
  Dashboard: "revenue-os-dashboard",
  "Deep audit findings": "revenue-os-deep-audit",
  "Super Admin packages": "revenue-os-superadmin-packages",
  Pipeline: "revenue-os-pipeline",
};

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

  const heroShot = SHOT_BY_LABEL[c.screenshots[0]?.label ?? ""] ?? null;

  return (
    <>
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <div className="mkt-split">
            <div className="space-y-4">
              <p className="mkt-eyebrow">Case study</p>
              <h1 className="text-4xl font-extrabold text-balance sm:text-5xl">
                {c.title}
              </h1>
              <p className="text-[var(--mkt-accent)]">{c.clientType}</p>
              <p className="mkt-muted">{c.status}</p>
              {c.platformFeatures?.length ? (
                <ul className="m-0 list-none space-y-1.5 p-0 text-sm">
                  {c.platformFeatures.slice(0, 3).map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-[var(--mkt-accent)]" aria-hidden>
                        ✓
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {c.stack.slice(0, 6).map((s) => (
                  <span key={s} className="mkt-badge">
                    {s}
                  </span>
                ))}
              </div>
            </div>
            {heroShot ? (
              <ProductShot name={heroShot} alt={c.title} priority hero />
            ) : c.screenshots[0] ? (
              <BrowserFrame
                src={c.screenshots[0].src}
                alt={c.screenshots[0].alt}
                priority
              />
            ) : null}
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap mkt-split">
          <div className="mkt-prose space-y-3">
            <p className="mkt-eyebrow">Problem</p>
            <p className="leading-relaxed">{c.problem}</p>
          </div>
          <div className="space-y-3">
            <p className="mkt-eyebrow">What we built</p>
            <ul className="m-0 list-none space-y-2 p-0">
              {c.whatWeBuilt.map((item) => (
                <li key={item} className="text-sm leading-relaxed">
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
            <ul className="mkt-grid-2 m-0 list-none p-0">
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
          <div className="mkt-wrap mkt-prose space-y-4">
            <p className="mkt-eyebrow">Security</p>
            <ul className="m-0 list-none space-y-2 p-0">
              {c.security.map((n) => (
                <li key={n} className="text-sm">
                  · {n}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {c.results.length > 0 ? (
        <section className="mkt-section mkt-section--dark">
          <div className="mkt-wrap mkt-prose space-y-4">
            <p className="mkt-eyebrow">Results</p>
            <ul className="m-0 list-none space-y-2 p-0">
              {c.results.map((r) => (
                <li key={r} className="mkt-card text-sm">
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {c.screenshots.length > 0 ? (
        <section className="mkt-section mkt-section--light">
          <div className="mkt-wrap space-y-8">
            <p className="mkt-eyebrow">Screenshots</p>
            <div className="mkt-grid-2">
              {c.screenshots.map((shot) => {
                const name = SHOT_BY_LABEL[shot.label];
                return (
                  <figure key={shot.src} className="space-y-2">
                    {name ? (
                      <ProductShot name={name} alt={shot.alt} />
                    ) : (
                      <BrowserFrame src={shot.src} alt={shot.alt} />
                    )}
                    <figcaption className="text-sm text-[var(--mkt-ink-muted)]">
                      {shot.label}
                    </figcaption>
                  </figure>
                );
              })}
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

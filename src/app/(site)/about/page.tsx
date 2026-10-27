import Link from "next/link";
import type { Metadata } from "next";
import {
  aboutContent,
  processSteps,
  siteConfig,
  values,
} from "@/content/site";

export const metadata: Metadata = {
  title: "About",
  description: "How Delvix Studio works: fixed scope, weekly demos, code you own.",
  alternates: { canonical: `${siteConfig.url}/about` },
};

export default function AboutPage() {
  const showStory = Boolean(aboutContent.founderStory?.trim());
  const showTeam = siteConfig.team.length > 0;

  return (
    <>
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap max-w-3xl space-y-4">
          <p className="mkt-eyebrow">About</p>
          <h1 className="text-4xl font-extrabold sm:text-5xl">
            {aboutContent.headline}
          </h1>
          <p className="mkt-muted text-lg leading-relaxed">{aboutContent.intro}</p>
          <ul className="space-y-2 pt-2">
            {aboutContent.howWeDiffer.map((line) => (
              <li key={line} className="mkt-card text-sm">
                {line}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {showStory ? (
        <section className="mkt-section mkt-section--light">
          <div className="mkt-wrap max-w-3xl space-y-4">
            <p className="mkt-eyebrow">Founder</p>
            <p className="leading-relaxed text-[var(--mkt-ink)] whitespace-pre-line">
              {aboutContent.founderStory}
            </p>
          </div>
        </section>
      ) : null}

      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <div className="max-w-2xl space-y-3">
            <p className="mkt-eyebrow">How we work</p>
            <h2 className="text-3xl font-extrabold sm:text-4xl">
              Same process on every engagement
            </h2>
          </div>
          <ol className="mkt-grid-3">
            {processSteps.map((step) => (
              <li key={step.n} className="mkt-card">
                <p className="mb-2 text-sm font-bold text-[var(--mkt-accent)]">
                  {step.n}
                </p>
                <h3 className="mb-2 text-lg font-bold">{step.title}</h3>
                <p className="mkt-muted text-sm">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {values.length > 0 ? (
        <section className="mkt-section mkt-section--light">
          <div className="mkt-wrap space-y-8">
            <p className="mkt-eyebrow">Values</p>
            <div className="mkt-grid-3">
              {values.map((v) => (
                <div key={v.title} className="mkt-card">
                  <h3 className="mb-2 text-lg font-bold">{v.title}</h3>
                  <p className="mkt-muted text-sm">{v.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {showTeam ? (
        <section className="mkt-section mkt-section--dark">
          <div className="mkt-wrap space-y-8">
            <p className="mkt-eyebrow">Team</p>
            <div className="mkt-grid-3">
              {siteConfig.team.map((m) => (
                <div key={m.name} className="mkt-card">
                  <h3 className="font-bold">{m.name}</h3>
                  <p className="text-sm text-[var(--mkt-accent)]">{m.role}</p>
                  {m.bio ? <p className="mkt-muted mt-2 text-sm">{m.bio}</p> : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="mkt-section mkt-section--cta">
        <div className="mkt-wrap text-center">
          <Link
            href={siteConfig.contact.bookingUrl}
            className="mkt-btn mkt-btn--primary"
            data-mkt-schedule
          >
            Book a free call
          </Link>
        </div>
      </section>
    </>
  );
}

import type { Metadata } from "next";
import { PageBreadcrumb } from "@/components/marketing/page-breadcrumb";
import { PageVisual } from "@/components/marketing/page-visual";
import { RelatedPages } from "@/components/marketing/related-pages";
import { SectionCta } from "@/components/marketing/section-cta";
import { aboutPage } from "@/content/pages";
import { siteConfig } from "@/content/site";
import { buildPageMetadata } from "@/lib/marketing/page-metadata";
import { visualForPath } from "@/lib/marketing/page-visuals";

export const metadata: Metadata = buildPageMetadata({
  title: aboutPage.seoTitle,
  description: aboutPage.seoDescription,
  path: "/about",
});

export default function AboutPage() {
  const { founderStory, workingHours } = aboutPage;
  const showStory = founderStory.enabled && founderStory.body.trim().length > 0;
  const showTeam = siteConfig.team.length > 0;

  return (
    <>
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <PageBreadcrumb current="About" currentPath="/about" />
          <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <p className="mkt-eyebrow">About</p>
              <h1 className="text-4xl font-extrabold sm:text-5xl">{aboutPage.h1}</h1>
              <p className="mkt-muted text-lg leading-relaxed">{aboutPage.intro}</p>
            </div>
            <PageVisual visual={visualForPath("/about")} alt="How Delvix Studio works" priority />
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap grid items-center gap-10 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-3">
            <p className="mkt-eyebrow">Mission</p>
            <h2 className="text-3xl font-extrabold">{aboutPage.mission.title}</h2>
            <p className="text-lg leading-relaxed">{aboutPage.mission.body}</p>
          </div>
          <PageVisual visual={visualForPath("/about")} alt="How the studio operates" />
        </div>
      </section>

      {showStory ? (
        <section className="mkt-section mkt-section--dark">
          <div className="mkt-wrap max-w-3xl space-y-4">
            <p className="mkt-eyebrow">Founder</p>
            <p className="whitespace-pre-line leading-relaxed">
              {founderStory.body}
            </p>
          </div>
        </section>
      ) : null}

      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <div className="max-w-2xl space-y-3">
            <p className="mkt-eyebrow">Principles</p>
            <h2 className="text-3xl font-extrabold">How we like to work</h2>
          </div>
          <div className="mkt-grid-3">
            {aboutPage.principles.map((p) => (
              <div key={p.title} className="mkt-card">
                <h3 className="mb-2 text-lg font-bold">{p.title}</h3>
                <p className="mkt-muted text-sm leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap grid gap-10 lg:grid-cols-2">
          <div className="space-y-4">
            <p className="mkt-eyebrow">Working hours</p>
            <h2 className="text-3xl font-extrabold">{workingHours.title}</h2>
            <p className="leading-relaxed">{workingHours.body}</p>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {workingHours.regions.map((r) => (
                <li key={r} className="mkt-badge">
                  {r}
                </li>
              ))}
            </ul>
            <p className="mkt-muted text-sm leading-relaxed">
              {workingHours.overlapNote}
            </p>
          </div>
          <ul className="m-0 list-none space-y-3 p-0">
            {workingHours.points.map((pt) => (
              <li key={pt} className="mkt-card text-sm leading-relaxed">
                {pt}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {showTeam ? (
        <section className="mkt-section mkt-section--dark">
          <div className="mkt-wrap space-y-8">
            <p className="mkt-eyebrow">Team</p>
            <div className="mkt-grid-3">
              {siteConfig.team.map((m) => (
                <div key={m.name} className="mkt-card">
                  <h3 className="font-bold">{m.name}</h3>
                  <p className="text-sm text-[var(--mkt-accent)]">{m.role}</p>
                  {m.bio ? (
                    <p className="mkt-muted mt-2 text-sm">{m.bio}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <RelatedPages
        tone={showTeam ? "light" : "dark"}
        links={[
          { href: "/process", label: "How we work" },
          { href: "/security", label: "Security and data handling" },
          { href: "/careers", label: "Careers at Delvix Studio" },
        ]}
      />
      <SectionCta
        title="Want to see how we would approach your project?"
        sub="Book a short call and we will tell you plainly what we would do."
      />
    </>
  );
}

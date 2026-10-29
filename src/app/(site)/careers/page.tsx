import Link from "next/link";
import type { Metadata } from "next";
import { PageBreadcrumb } from "@/components/marketing/page-breadcrumb";
import { PageVisual } from "@/components/marketing/page-visual";
import { RelatedPages } from "@/components/marketing/related-pages";
import { SectionCta } from "@/components/marketing/section-cta";
import { careersPage } from "@/content/pages";
import { buildPageMetadata } from "@/lib/marketing/page-metadata";
import { visualForPath } from "@/lib/marketing/page-visuals";

export const metadata: Metadata = buildPageMetadata({
  title: careersPage.seoTitle,
  description: careersPage.seoDescription,
  path: "/careers",
});

export default function CareersPage() {
  const { howToApply } = careersPage;

  return (
    <>
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <PageBreadcrumb current="Careers" currentPath="/careers" />
          <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <p className="mkt-eyebrow">Careers</p>
              <h1 className="text-4xl font-extrabold sm:text-5xl">{careersPage.h1}</h1>
              <p className="mkt-muted text-lg leading-relaxed">{careersPage.intro}</p>
              <p className="mkt-muted text-sm leading-relaxed">{careersPage.note}</p>
              <a
                href={`mailto:${howToApply.email}`}
                className="mkt-btn mkt-btn--primary inline-flex"
              >
                Email {howToApply.email}
              </a>
            </div>
            <PageVisual visual={visualForPath("/careers")} alt="Working with Delvix Studio" priority />
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap mb-10">
          <PageVisual visual={visualForPath("/careers")} alt="Working with the studio team" />
        </div>
        <div className="mkt-wrap grid gap-10 lg:grid-cols-2">
          <div className="space-y-4">
            <p className="mkt-eyebrow">How to apply</p>
            <h2 className="text-3xl font-extrabold">{howToApply.title}</h2>
            <ol className="m-0 list-none space-y-3 p-0">
              {howToApply.steps.map((s, i) => (
                <li key={s} className="mkt-card flex gap-3 text-sm leading-relaxed">
                  <span className="font-mono text-[var(--mkt-accent)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            <p className="mkt-muted text-sm leading-relaxed">
              {howToApply.emailNote}{" "}
              <a className="mkt-link" href={`mailto:${howToApply.email}`}>
                {howToApply.email}
              </a>
            </p>
          </div>
          <div className="space-y-4">
            <p className="mkt-eyebrow">What to include</p>
            <h2 className="text-3xl font-extrabold">Send us</h2>
            <ul className="m-0 list-none space-y-2 p-0">
              {careersPage.whatToInclude.map((line) => (
                <li key={line} className="mkt-card text-sm leading-relaxed">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap max-w-3xl space-y-4">
          <p className="mkt-eyebrow">What we look for</p>
          <h2 className="text-3xl font-extrabold">The kind of developer we work with</h2>
          <ul className="m-0 list-none space-y-2 p-0">
            {careersPage.whatWeLookFor.map((line) => (
              <li key={line} className="mkt-card text-sm leading-relaxed">
                {line}
              </li>
            ))}
          </ul>
          <Link href="/about" className="mkt-link text-sm">
            More about how we work →
          </Link>
        </div>
      </section>

      <RelatedPages
        tone="light"
        links={[
          { href: "/about", label: "About Delvix Studio" },
          { href: "/process", label: "How we work" },
          { href: "/contact", label: "Contact us" },
        ]}
      />
      <SectionCta
        title="Looking for software help instead?"
        sub="Tell us what you are running on today and we will take it from there."
      />
    </>
  );
}

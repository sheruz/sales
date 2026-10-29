import type { Metadata } from "next";
import { PageBreadcrumb } from "@/components/marketing/page-breadcrumb";
import { PageVisual } from "@/components/marketing/page-visual";
import { RelatedPages } from "@/components/marketing/related-pages";
import { SectionCta } from "@/components/marketing/section-cta";
import { processPageDetailed } from "@/content/pages";
import { buildPageMetadata } from "@/lib/marketing/page-metadata";
import { visualForPath } from "@/lib/marketing/page-visuals";

export const metadata: Metadata = buildPageMetadata({
  title: processPageDetailed.seoTitle,
  description: processPageDetailed.seoDescription,
  path: "/process",
});

export default function ProcessPage() {
  const { steps, communication, sampleWeek } = processPageDetailed;

  return (
    <>
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <PageBreadcrumb current="How we work" currentPath="/process" />
          <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <p className="mkt-eyebrow">Process</p>
              <h1 className="text-4xl font-extrabold sm:text-5xl">
                {processPageDetailed.h1}
              </h1>
              <p className="mkt-muted text-lg leading-relaxed">
                {processPageDetailed.intro}
              </p>
            </div>
            <PageVisual
              visual={visualForPath("/process")}
              alt="Delivery process timeline"
              priority
            />
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap space-y-8">
          <PageVisual
            visual={visualForPath("/process")}
            alt="End-to-end delivery timeline"
            className="max-w-4xl"
          />
          <ol className="m-0 list-none space-y-6 p-0">
            {steps.map((s) => (
              <li key={s.number} className="mkt-card grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
                <div className="space-y-2">
                  <p className="font-mono text-sm text-[var(--mkt-accent)]">
                    {String(s.number).padStart(2, "0")}
                  </p>
                  <h2 className="text-2xl font-bold">{s.title}</h2>
                  <p className="mkt-muted text-sm leading-relaxed">{s.summary}</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-[var(--mkt-accent)]">
                      What we do
                    </h3>
                    <p className="text-sm leading-relaxed">{s.whatWeDo}</p>
                  </div>
                  <div>
                    <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-[var(--mkt-accent)]">
                      What you get
                    </h3>
                    <ul className="m-0 list-disc space-y-1 pl-5 text-sm">
                      {s.whatYouGet.map((g) => (
                        <li key={g}>{g}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-8">
          <div className="max-w-2xl space-y-3">
            <p className="mkt-eyebrow">Communication</p>
            <h2 className="text-3xl font-extrabold">{communication.title}</h2>
            <p className="mkt-muted leading-relaxed">{communication.body}</p>
          </div>
          <div className="mkt-grid-3">
            {communication.tools.map((t) => (
              <div key={t.title} className="mkt-card">
                <h3 className="mb-2 text-lg font-bold">{t.title}</h3>
                <p className="mkt-muted text-sm leading-relaxed">{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap space-y-8">
          <div className="max-w-2xl space-y-3">
            <p className="mkt-eyebrow">A typical week</p>
            <h2 className="text-3xl font-extrabold">{sampleWeek.title}</h2>
            <p className="leading-relaxed">{sampleWeek.intro}</p>
          </div>
          <div className="mkt-card overflow-x-auto">
            <table className="mkt-table">
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  <th scope="col">Focus</th>
                </tr>
              </thead>
              <tbody>
                {sampleWeek.days.map((d) => (
                  <tr key={d.day}>
                    <th scope="row">{d.day}</th>
                    <td>{d.focus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mkt-muted max-w-3xl text-sm leading-relaxed">
            {sampleWeek.note}
          </p>
        </div>
      </section>

      <RelatedPages
        tone="dark"
        links={[
          { href: "/pricing", label: "Pricing and engagement models" },
          { href: "/services", label: "All services" },
          { href: "/free-audit", label: "Get a free website audit" },
        ]}
      />
      <SectionCta
        title="Ready to start with a discovery call?"
        sub="It is the first step above, and it is free."
      />
    </>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { Check, ChevronDown } from "lucide-react";
import { buildPageMetadata } from "@/lib/marketing/page-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Pricing | Delvix Studio",
  description: "Clear pricing, agreed before we start. Every project gets a written scope and a fixed price.",
  path: "/pricing",
});

const models = [
  {
    title: "Fixed-price project",
    price: "[From $X]",
    unit: "per project",
    text: "A defined app, portal or system with a written scope.",
    points: [
      "Written scope in 3 days",
      "Milestone payments",
      "Weekly demos",
      "Full code ownership",
    ],
    cta: "Get a quote",
    href: "/contact?type=quote",
    featured: false,
    bg: "mkt-card",
    btnClass: "mkt-btn mkt-btn--secondary",
  },
  {
    title: "Monthly retainer",
    price: "[From $X]",
    unit: "/ month",
    text: "Ongoing improvements to a live product.",
    points: [
      "Planned work each month",
      "Priority fixes",
      "Monthly report",
      "Cancel with 30 days notice",
    ],
    cta: "Discuss a retainer",
    href: "/contact?type=retainer",
    featured: true,
    bg: "mkt-card mkt-card--light mkt-card--featured",
    btnClass: "mkt-btn mkt-btn--primary",
  },
  {
    title: "Dedicated developer",
    price: "[From $X]",
    unit: "/ month",
    text: "A developer working inside your team and tools.",
    points: [
      "Full-time or part-time",
      "Overlap with your hours",
      "Your tools and process",
      "Replace if not a fit",
    ],
    cta: "Hire a developer",
    href: "/contact?type=developer",
    featured: false,
    bg: "mkt-card",
    btnClass: "mkt-btn mkt-btn--secondary",
  },
];

const offers = [
  {
    name: "[Offer name, e.g. Website fix + speed-up]",
    price: "[$X]",
    text: "[What is included and delivery days]",
  },
  {
    name: "[Offer name, e.g. Mobile quote form]",
    price: "[$X]",
    text: "[What is included and delivery days]",
  },
  {
    name: "[Offer name, e.g. Discovery & scope]",
    price: "[$X]",
    text: "[What is included and delivery days]",
  },
];

const factors = [
  {
    t: "Number of screens and user roles",
    d: "More user types and screens mean more design and build time.",
  },
  {
    t: "Integrations",
    d: "Each connected system (payments, accounting, ELD) adds work.",
  },
  {
    t: "Data migration",
    d: "Moving existing spreadsheets or old systems into the new one.",
  },
  {
    t: "Mobile apps",
    d: "A native app on top of a web app adds a second front end.",
  },
  {
    t: "AI features",
    d: "AI usage costs are billed by the provider on your own account.",
  },
];

const faq = [
  {
    q: "Do you charge by the hour?",
    a: "No. Projects are fixed price based on the written scope. Retainers and dedicated developers are monthly.",
  },
  {
    q: "How do payments work?",
    a: "Fixed-price projects are paid in milestones. Monthly plans are paid at the start of each month.",
  },
  {
    q: "What if we need changes during the project?",
    a: "Small changes fit into weekly demos. Bigger changes get a written estimate before we do them.",
  },
  {
    q: "Which payment methods do you accept?",
    a: "[CONFIRM: e.g. bank transfer, card, Payoneer]",
  },
];

export default function PricingPage() {
  return (
    <>
      {/* Hero */}
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap mx-auto flex max-w-4xl flex-col items-center gap-5 text-center">
          <p className="mkt-eyebrow">Pricing</p>
          <h1 className="text-4xl font-extrabold text-balance leading-tight sm:text-5xl lg:text-6xl">
            Clear pricing, agreed before we start.
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground">
            Every project gets a written scope and a fixed price. No hourly surprises.
          </p>
        </div>
      </section>

      {/* Models */}
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap grid gap-5 lg:grid-cols-3">
          {models.map((model) => (
            <div key={model.title} className={model.bg}>
              {model.featured ? (
                <span className="mkt-badge-primary mb-3 inline-block">
                  Most common
                </span>
              ) : null}
              <h2 className="mb-2 text-2xl font-bold">{model.title}</h2>
              <div className="mb-2 flex items-baseline gap-2">
                <strong className="text-4xl font-extrabold">{model.price}</strong>
                <span className="text-sm text-muted-foreground">
                  {model.unit}
                </span>
              </div>
              <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                {model.text}
              </p>
              <ul className="mb-6 space-y-2">
                {model.points.map((point) => (
                  <li key={point} className="flex gap-2 text-sm leading-relaxed">
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-[var(--mkt-accent)]"
                      aria-hidden="true"
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <Link href={model.href} className={`${model.btnClass} block text-center`}>
                {model.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Starter Offers */}
      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap space-y-10">
          <div className="max-w-3xl space-y-4">
            <p className="mkt-eyebrow">Starter offers</p>
            <h2 className="text-3xl font-extrabold text-balance sm:text-4xl">
              Small, fixed packages to get started.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {offers.map((offer) => (
              <div
                key={offer.name}
                className="mkt-card mkt-card--dashed space-y-3"
              >
                <h3 className="text-lg font-bold">{offer.name}</h3>
                <p className="text-3xl font-extrabold text-[var(--mkt-accent)]">
                  {offer.price}
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {offer.text}
                </p>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Fill these from your Business Brain starter offers, or hide the section.
          </p>
        </div>
      </section>

      {/* What Affects Price + FAQ */}
      <section className="mkt-section mkt-section--subtle">
        <div className="mkt-wrap grid gap-12 lg:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-3xl font-extrabold text-balance sm:text-4xl">
              What affects the price
            </h2>
            <div className="space-y-0">
              {factors.map((factor) => (
                <div
                  key={factor.t}
                  className="space-y-1 border-b border-[var(--mkt-line)] py-4 first:pt-0"
                >
                  <h3 className="font-semibold">{factor.t}</h3>
                  <p className="text-sm text-muted-foreground">{factor.d}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="mb-4 text-3xl font-extrabold text-balance sm:text-4xl">
              Pricing questions
            </h2>
            <div className="space-y-3">
              {faq.map((item) => (
                <details
                  key={item.q}
                  className="mkt-card mkt-card--light group"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                    {item.q}
                    <ChevronDown
                      className="h-5 w-5 shrink-0 text-[var(--mkt-accent)] transition-transform group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

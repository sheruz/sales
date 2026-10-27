import Link from "next/link";
import type { Metadata } from "next";
import { engagementModels, siteConfig } from "@/content/site";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Fixed-price projects, monthly retainers and dedicated developers. Prices published when set.",
  alternates: { canonical: `${siteConfig.url}/pricing` },
};

function formatFrom(priceFrom?: number, currency?: string) {
  if (priceFrom == null || !Number.isFinite(priceFrom)) return null;
  const cur = currency || "USD";
  try {
    return `from ${new Intl.NumberFormat("en", {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 0,
    }).format(priceFrom)}`;
  } catch {
    return `from $${priceFrom}`;
  }
}

export default function PricingPage() {
  const offers = siteConfig.offers;

  return (
    <>
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap max-w-3xl space-y-4">
          <p className="mkt-eyebrow">Pricing</p>
          <h1 className="text-4xl font-extrabold sm:text-5xl">
            Engagement models
          </h1>
          <p className="mkt-muted text-lg">
            Pick how you want to work. Detailed numbers appear only when published
            in config — we do not invent rates here.
          </p>
        </div>
      </section>

      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap mkt-grid-3">
          {engagementModels.map((m) => (
            <div key={m.name} className="mkt-card">
              <h2 className="mb-2 text-xl font-bold">{m.name}</h2>
              <p className="mkt-muted mb-4 text-sm">Fits: {m.fits}</p>
              <ul className="mb-5 space-y-2 text-sm">
                {m.includes.map((line) => (
                  <li key={line}>· {line}</li>
                ))}
              </ul>
              <Link
                href={siteConfig.contact.bookingUrl}
                className="mkt-link text-sm"
                data-mkt-schedule
              >
                Get pricing →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {offers.length > 0 ? (
        <section className="mkt-section mkt-section--dark">
          <div className="mkt-wrap space-y-8">
            <div className="max-w-2xl space-y-3">
              <p className="mkt-eyebrow">Starter offers</p>
              <h2 className="text-3xl font-extrabold">Fixed packages</h2>
            </div>
            <div className="mkt-grid-3">
              {offers.map((o) => {
                const price = formatFrom(o.priceFrom, o.currency);
                return (
                  <div key={o.name} className="mkt-card">
                    <h3 className="mb-2 text-lg font-bold">{o.name}</h3>
                    {price ? (
                      <p className="mb-2 text-[var(--mkt-accent)]">{price}</p>
                    ) : null}
                    {o.days ? (
                      <p className="mkt-muted mb-3 text-sm">{o.days} days</p>
                    ) : null}
                    <p className="mb-4 text-sm leading-relaxed">{o.includes}</p>
                    <Link
                      href={o.href || siteConfig.contact.bookingUrl}
                      className="mkt-link text-sm"
                      data-mkt-schedule={o.href ? undefined : true}
                    >
                      Get started →
                    </Link>
                  </div>
                );
              })}
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

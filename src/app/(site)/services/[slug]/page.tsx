import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getService, services, siteConfig } from "@/content/site";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return services.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const s = getService(slug);
  if (!s) return {};
  return {
    title: s.name,
    description: s.short,
    alternates: { canonical: `${siteConfig.url}/services/${s.slug}` },
  };
}

export default async function ServiceDetailPage({ params }: Props) {
  const { slug } = await params;
  const s = getService(slug);
  if (!s) notFound();

  const serviceLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: s.name,
    description: s.short,
    provider: { "@type": "Organization", name: siteConfig.name },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceLd) }}
      />
      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap max-w-3xl space-y-6">
          <p className="mkt-eyebrow">Service</p>
          <h1 className="text-4xl font-extrabold sm:text-5xl">{s.name}</h1>
          <p className="mkt-muted text-lg">{s.short}</p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={siteConfig.contact.bookingUrl}
              className="mkt-btn mkt-btn--primary"
              data-mkt-schedule
            >
              Book a free call
            </Link>
            <Link href="/contact" className="mkt-btn mkt-btn--secondary">
              Get a quote
            </Link>
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--light">
        <div className="mkt-wrap grid gap-10 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="mkt-eyebrow">Problem</p>
            <h2 className="text-2xl font-bold">What this usually looks like</h2>
            <p className="mkt-muted leading-relaxed">{s.problem}</p>
          </div>
          <div className="space-y-3">
            <p className="mkt-eyebrow">What we build</p>
            <ul className="space-y-2">
              {s.whatWeBuild.map((line) => (
                <li key={line} className="mkt-card text-sm">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap space-y-6">
          <p className="mkt-eyebrow">Stack</p>
          <div className="flex flex-wrap gap-2">
            {s.stack.map((t) => (
              <span key={t} className="mkt-badge">
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {s.faq.length > 0 ? (
        <section className="mkt-section mkt-section--light">
          <div className="mkt-wrap max-w-3xl space-y-4">
            <p className="mkt-eyebrow">FAQ</p>
            <h2 className="text-3xl font-bold">Questions</h2>
            {s.faq.map((f) => (
              <details key={f.q} className="mkt-card">
                <summary className="cursor-pointer font-semibold">{f.q}</summary>
                <p className="mkt-muted mt-3 text-sm">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mkt-section mkt-section--dark">
        <div className="mkt-wrap max-w-2xl space-y-4 text-center">
          <h2 className="text-3xl font-bold">Ready to scope this?</h2>
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

import Link from "next/link";
import { siteConfig, valueTags } from "@/content/site";

export function SectionCta({
  title = "Tell us what you're running on today",
  sub,
  showAuditLink = true,
}: {
  title?: string;
  sub?: string;
  /** Soft link to /free-audit under the buttons. Disable on the audit page itself. */
  showAuditLink?: boolean;
}) {
  return (
    <section className="mkt-section mkt-section--cta">
      <div className="mkt-wrap max-w-3xl space-y-6 text-center">
        <p className="mkt-eyebrow justify-center">Next step</p>
        <h2 className="text-3xl font-extrabold sm:text-4xl">{title}</h2>
        {sub ? <p className="mkt-muted text-lg">{sub}</p> : null}
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href={siteConfig.contact.bookingUrl}
            className="mkt-btn mkt-btn--primary"
            data-mkt-schedule
          >
            Book a free call
          </Link>
          <a
            href={siteConfig.contact.whatsapp}
            className="mkt-btn mkt-btn--secondary"
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp
          </a>
          <Link href="/contact" className="mkt-btn mkt-btn--secondary">
            Get a quote
          </Link>
        </div>
        {showAuditLink ? (
          <p className="text-sm">
            <Link href="/free-audit" className="mkt-link">
              Get a free audit
            </Link>
          </p>
        ) : null}
        <ul className="flex flex-wrap justify-center gap-2 pt-1">
          {valueTags.map((t) => (
            <li key={t} className="mkt-badge">
              {t}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

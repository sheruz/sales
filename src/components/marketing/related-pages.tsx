import Link from "next/link";

export type RelatedPageLink = { href: string; label: string };

/** Grid of related links (designed for 3). Renders its own section. */
export function RelatedPages({
  links,
  title = "Related pages",
  tone = "light",
}: {
  links: RelatedPageLink[];
  title?: string;
  tone?: "light" | "dark";
}) {
  if (links.length === 0) return null;
  return (
    <section className={`mkt-section mkt-section--${tone}`}>
      <div className="mkt-wrap space-y-6">
        <div className="max-w-2xl space-y-3">
          <p className="mkt-eyebrow">Keep exploring</p>
          <h2 className="text-3xl font-extrabold">{title}</h2>
        </div>
        <div className="mkt-grid-3">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="mkt-card block">
              <h3 className="mb-3 text-lg font-bold">{l.label}</h3>
              <span className="mkt-link text-sm">Read more →</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

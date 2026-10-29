export type FaqEntry = { q: string; a: string };

/** FAQPage JSON-LD object for a list of Q&A pairs. */
export function faqJsonLd(items: FaqEntry[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** Inline JSON-LD script. `<` is escaped so content can never close the tag. */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

/** details/summary FAQ section. Emits FAQPage JSON-LD unless `schema={false}`. */
export function FaqBlock({
  items,
  title = "Frequently asked questions",
  tone = "dark",
  schema = true,
}: {
  items: FaqEntry[];
  title?: string;
  tone?: "light" | "dark";
  schema?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section className={`mkt-section mkt-section--${tone}`}>
      {schema ? <JsonLd data={faqJsonLd(items)} /> : null}
      <div className="mkt-wrap max-w-3xl space-y-4">
        <p className="mkt-eyebrow">FAQ</p>
        <h2 className="text-3xl font-bold">{title}</h2>
        {items.map((f) => (
          <details key={f.q} className="mkt-card">
            <summary className="cursor-pointer font-semibold">{f.q}</summary>
            <p className="mkt-muted mt-3 text-sm leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

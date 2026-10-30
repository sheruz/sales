import Link from "next/link";
import { VisualThumb } from "@/components/marketing/visual-thumb";
import type { PageVisualKey } from "@/lib/marketing/page-visuals";

type Props = {
  href: string;
  title: string;
  description: string;
  visual?: PageVisualKey;
  eyebrow?: string;
  cta?: string;
};

/** Equal-height card: image, title ≤2 lines, description ≤3 lines, CTA at bottom. */
export function MarketingCard({
  href,
  title,
  description,
  visual,
  eyebrow,
  cta = "Learn more →",
}: Props) {
  return (
    <Link href={href} className="mkt-card mkt-card--link flex h-full flex-col">
      {visual ? (
        <VisualThumb
          visual={visual}
          alt={title}
          aspect="wide"
          className="mkt-card-thumb"
        />
      ) : null}
      {eyebrow ? (
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--mkt-accent)]">
          {eyebrow}
        </p>
      ) : null}
      <h3 className="mkt-card__title text-balance">{title}</h3>
      <p className="mkt-muted mkt-card__desc text-sm leading-relaxed">
        {description}
      </p>
      <span className="mkt-link mt-auto pt-4 text-sm">{cta}</span>
    </Link>
  );
}

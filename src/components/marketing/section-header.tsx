import Link from "next/link";

type Props = {
  eyebrow: string;
  title: string;
  lead?: string;
  /** Right-aligned on desktop, below lead on mobile */
  action?: { href: string; label: string };
  className?: string;
};

/** Identical section header pattern used across the marketing site. */
export function SectionHeader({
  eyebrow,
  title,
  lead,
  action,
  className = "",
}: Props) {
  return (
    <div className={`mkt-section-header ${className}`}>
      <div className="mkt-section-header__main">
        <p className="mkt-eyebrow">{eyebrow}</p>
        <div className="mkt-section-header__row">
          <h2 className="mkt-section-header__title text-balance">{title}</h2>
          {action ? (
            <Link
              href={action.href}
              className="mkt-link mkt-section-header__action hidden lg:inline-flex"
            >
              {action.label}
            </Link>
          ) : null}
        </div>
        {lead ? (
          <p className="mkt-muted mkt-section-header__lead text-lg">{lead}</p>
        ) : null}
        {action ? (
          <Link
            href={action.href}
            className="mkt-link mkt-section-header__action lg:hidden"
          >
            {action.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

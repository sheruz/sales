import Link from "next/link";
import { siteConfig } from "@/content/site";

export type BreadcrumbSection = { label: string; href: string };

/**
 * Simple breadcrumb: Home / Section / Current.
 * Render inside an existing `.mkt-wrap`. Also emits BreadcrumbList JSON-LD.
 */
export function PageBreadcrumb({
  section,
  current,
  currentPath,
}: {
  section?: BreadcrumbSection;
  current: string;
  /** Path of the current page (for JSON-LD), e.g. "/services/discovery" */
  currentPath?: string;
}) {
  const items: Array<{ label: string; href?: string }> = [
    { label: "Home", href: "/" },
    ...(section ? [{ label: section.label, href: section.href }] : []),
    { label: current },
  ];

  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      item: item.href
        ? `${siteConfig.url}${item.href === "/" ? "" : item.href}`
        : currentPath
          ? `${siteConfig.url}${currentPath}`
          : undefined,
    })),
  };

  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      <ol className="m-0 flex list-none flex-wrap items-center gap-x-2 gap-y-1 p-0">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-2">
            {item.href ? (
              <Link href={item.href} className="mkt-link">
                {item.label}
              </Link>
            ) : (
              <span className="mkt-muted" aria-current="page">
                {item.label}
              </span>
            )}
            {i < items.length - 1 ? (
              <span className="mkt-muted" aria-hidden>
                /
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(ld).replace(/</g, "\\u003c"),
        }}
      />
    </nav>
  );
}

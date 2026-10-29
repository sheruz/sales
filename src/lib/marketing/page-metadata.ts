import type { Metadata } from "next";
import { siteConfig } from "@/content/site";

/**
 * Metadata for marketing pages. Uses the SEO title as-is (the layout title
 * template would otherwise append the site name a second time) and repeats the
 * Open Graph image because page-level `openGraph` replaces the layout's.
 */
export function buildPageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const url = `${siteConfig.url}${path}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: siteConfig.name,
      title,
      description,
      images: [{ url: siteConfig.logoOnDark }],
    },
  };
}

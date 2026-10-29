import type { MetadataRoute } from "next";
import {
  aiPages,
  industryPages,
  servicePages,
  technologyPages,
} from "@/content/pages";
import { caseStudies, siteConfig, solutions } from "@/content/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url;
  const now = new Date();

  const staticRoutes = [
    "",
    "/services",
    "/ai",
    "/industries",
    "/technologies",
    "/work",
    "/about",
    "/process",
    "/pricing",
    "/security",
    "/careers",
    "/free-audit",
    "/contact",
    "/autopilot",
    "/solutions",
    "/faq",
    "/for-agencies",
    "/privacy",
    "/terms",
    "/cookies",
  ];

  const detail = (
    prefix: string,
    slugs: string[],
    priority: number,
  ): MetadataRoute.Sitemap =>
    slugs.map((slug) => ({
      url: `${base}${prefix}/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority,
    }));

  return [
    ...staticRoutes.map((path) => ({
      url: `${base}${path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
    })),
    ...detail("/services", servicePages.map((p) => p.slug), 0.8),
    ...detail("/ai", aiPages.map((p) => p.slug), 0.8),
    ...detail("/industries", industryPages.map((p) => p.slug), 0.6),
    ...detail("/technologies", technologyPages.map((p) => p.slug), 0.5),
    ...detail("/solutions", solutions.map((s) => s.slug), 0.6),
    ...detail(
      "/work",
      caseStudies.filter((c) => c.verified).map((c) => c.slug),
      0.8,
    ),
  ];
}

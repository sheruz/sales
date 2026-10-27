import type { MetadataRoute } from "next";
import {
  caseStudies,
  industries,
  services,
  siteConfig,
  solutions,
  technologies,
} from "@/content/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url;
  const staticRoutes = [
    "",
    "/services",
    "/industries",
    "/work",
    "/about",
    "/contact",
    "/pricing",
    "/autopilot",
    "/process",
    "/faq",
    "/security",
    "/solutions",
    "/technologies",
    "/for-agencies",
    "/privacy",
    "/terms",
    "/cookies",
  ];

  return [
    ...staticRoutes.map((path) => ({
      url: `${base}${path}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
    })),
    ...services.map((s) => ({
      url: `${base}/services/${s.slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...industries.map((i) => ({
      url: `${base}/industries/${i.slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...solutions.map((s) => ({
      url: `${base}/solutions/${s.slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...technologies.map((t) => ({
      url: `${base}/technologies/${t.slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    ...caseStudies
      .filter((c) => c.verified)
      .map((c) => ({
        url: `${base}/work/${c.slug}`,
        lastModified: new Date(),
        changeFrequency: "monthly" as const,
        priority: 0.8,
      })),
  ];
}

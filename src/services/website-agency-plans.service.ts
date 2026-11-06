import prisma from "@/lib/db/prisma";
import { ValidationError } from "@/lib/api/response";

export type EngagementPlanInput = {
  slug: string;
  name: string;
  priceLabel: string;
  priceUnit: string;
  description: string;
  includes: string[];
  ctaLabel: string;
  ctaHref: string;
  featured?: boolean;
  active?: boolean;
  sortOrder?: number;
};

export type StarterOfferInput = {
  name: string;
  priceLabel: string;
  description: string;
  deliveryDays?: number | null;
  href?: string | null;
  active?: boolean;
  sortOrder?: number;
};

function slugify(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

class WebsiteAgencyPlansService {
  async listAll() {
    const [engagementPlans, starterOffers] = await Promise.all([
      prisma.websiteEngagementPlan.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
      prisma.websiteStarterOffer.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
    ]);
    return { engagementPlans, starterOffers };
  }

  /** Public marketing — active only */
  async listPublic() {
    const [engagementPlans, starterOffers] = await Promise.all([
      prisma.websiteEngagementPlan.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
      prisma.websiteStarterOffer.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
    ]);
    return { engagementPlans, starterOffers };
  }

  async createPlan(input: EngagementPlanInput) {
    const slug = slugify(input.slug || input.name);
    if (!slug) throw new ValidationError("Slug is required");
    if (!input.name.trim()) throw new ValidationError("Name is required");
    return prisma.websiteEngagementPlan.create({
      data: {
        slug,
        name: input.name.trim(),
        priceLabel: input.priceLabel.trim() || "From $X",
        priceUnit: input.priceUnit.trim() || "per project",
        description: input.description.trim(),
        includes: input.includes.map((s) => s.trim()).filter(Boolean),
        ctaLabel: input.ctaLabel.trim() || "Get a quote",
        ctaHref: input.ctaHref.trim() || "/contact",
        featured: Boolean(input.featured),
        active: input.active !== false,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  }

  async updatePlan(id: string, input: Partial<EngagementPlanInput>) {
    const existing = await prisma.websiteEngagementPlan.findUnique({
      where: { id },
    });
    if (!existing) throw new ValidationError("Plan not found");
    return prisma.websiteEngagementPlan.update({
      where: { id },
      data: {
        ...(input.slug != null
          ? { slug: slugify(input.slug) || existing.slug }
          : {}),
        ...(input.name != null ? { name: input.name.trim() } : {}),
        ...(input.priceLabel != null
          ? { priceLabel: input.priceLabel.trim() }
          : {}),
        ...(input.priceUnit != null
          ? { priceUnit: input.priceUnit.trim() }
          : {}),
        ...(input.description != null
          ? { description: input.description.trim() }
          : {}),
        ...(input.includes != null
          ? {
              includes: input.includes.map((s) => s.trim()).filter(Boolean),
            }
          : {}),
        ...(input.ctaLabel != null ? { ctaLabel: input.ctaLabel.trim() } : {}),
        ...(input.ctaHref != null ? { ctaHref: input.ctaHref.trim() } : {}),
        ...(input.featured != null ? { featured: Boolean(input.featured) } : {}),
        ...(input.active != null ? { active: Boolean(input.active) } : {}),
        ...(input.sortOrder != null ? { sortOrder: input.sortOrder } : {}),
      },
    });
  }

  async deletePlan(id: string) {
    await prisma.websiteEngagementPlan.delete({ where: { id } });
  }

  async createOffer(input: StarterOfferInput) {
    if (!input.name.trim()) throw new ValidationError("Name is required");
    return prisma.websiteStarterOffer.create({
      data: {
        name: input.name.trim(),
        priceLabel: input.priceLabel.trim() || "$X",
        description: input.description.trim(),
        deliveryDays: input.deliveryDays ?? null,
        href: input.href?.trim() || null,
        active: input.active !== false,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  }

  async updateOffer(id: string, input: Partial<StarterOfferInput>) {
    const existing = await prisma.websiteStarterOffer.findUnique({
      where: { id },
    });
    if (!existing) throw new ValidationError("Offer not found");
    return prisma.websiteStarterOffer.update({
      where: { id },
      data: {
        ...(input.name != null ? { name: input.name.trim() } : {}),
        ...(input.priceLabel != null
          ? { priceLabel: input.priceLabel.trim() }
          : {}),
        ...(input.description != null
          ? { description: input.description.trim() }
          : {}),
        ...(input.deliveryDays !== undefined
          ? { deliveryDays: input.deliveryDays }
          : {}),
        ...(input.href !== undefined
          ? { href: input.href?.trim() || null }
          : {}),
        ...(input.active != null ? { active: Boolean(input.active) } : {}),
        ...(input.sortOrder != null ? { sortOrder: input.sortOrder } : {}),
      },
    });
  }

  async deleteOffer(id: string) {
    await prisma.websiteStarterOffer.delete({ where: { id } });
  }
}

export const websiteAgencyPlansService = new WebsiteAgencyPlansService();

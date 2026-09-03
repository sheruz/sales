import prisma from "@/lib/db/prisma";
import { OfferStatus, type Prisma } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/response";

export type OfferInput = {
  serviceId: string;
  name: string;
  description?: string | null;
  problem?: string | null;
  solution?: string | null;
  outcome?: string | null;
  pricingModel?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
  currency?: string;
  deliveryTime?: string | null;
  status?: OfferStatus;
};

export class OfferService {
  async list(organizationId: string, includeArchived = false) {
    return prisma.offer.findMany({
      where: {
        organizationId,
        ...(includeArchived ? {} : { status: OfferStatus.ACTIVE }),
      },
      include: {
        service: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });
  }

  async getById(organizationId: string, id: string) {
    const offer = await prisma.offer.findFirst({
      where: { id, organizationId },
      include: { service: true },
    });
    if (!offer) throw new NotFoundError("Offer not found");
    return offer;
  }

  async create(organizationId: string, input: OfferInput) {
    const service = await prisma.service.findFirst({
      where: { id: input.serviceId, organizationId },
    });
    if (!service) throw new ValidationError("Service not found in organization");
    if (!input.name.trim()) throw new ValidationError("Offer name is required");

    return prisma.offer.create({
      data: {
        organizationId,
        serviceId: input.serviceId,
        name: input.name.trim(),
        description: input.description,
        problem: input.problem,
        solution: input.solution,
        outcome: input.outcome,
        pricingModel: input.pricingModel,
        minValue: input.minValue,
        maxValue: input.maxValue,
        currency: input.currency ?? "USD",
        deliveryTime: input.deliveryTime,
        status: input.status ?? OfferStatus.ACTIVE,
      },
    });
  }

  async update(organizationId: string, id: string, input: Partial<OfferInput>) {
    await this.getById(organizationId, id);
    if (input.serviceId) {
      const service = await prisma.service.findFirst({
        where: { id: input.serviceId, organizationId },
      });
      if (!service) throw new ValidationError("Service not found");
    }
    return prisma.offer.update({
      where: { id },
      data: {
        ...input,
        name: input.name?.trim(),
      } as Prisma.OfferUpdateInput,
    });
  }

  async archive(organizationId: string, id: string) {
    await this.getById(organizationId, id);
    return prisma.offer.update({
      where: { id },
      data: { status: OfferStatus.ARCHIVED },
    });
  }

  /** Ensure a default offer exists for a service (used by intelligence pipeline). */
  async ensureOfferForService(
    organizationId: string,
    serviceId: string,
    draft: {
      name: string;
      problem?: string;
      solution?: string;
      outcome?: string;
      minValue?: number | null;
      maxValue?: number | null;
      pricingModel?: string | null;
      deliveryTime?: string | null;
      description?: string | null;
    }
  ) {
    const existing = await prisma.offer.findFirst({
      where: {
        organizationId,
        serviceId,
        name: draft.name,
        status: OfferStatus.ACTIVE,
      },
    });
    if (existing) return existing;
    return this.create(organizationId, {
      serviceId,
      ...draft,
    });
  }
}

export const offerService = new OfferService();

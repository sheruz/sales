import prisma from "@/lib/db/prisma";
import { NotFoundError, ValidationError } from "@/lib/api/response";
import type { Prisma } from "@prisma/client";

export class ServiceCatalogService {
  async list(organizationId: string, includeInactive = false) {
    return prisma.service.findMany({
      where: {
        organizationId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { name: "asc" },
    });
  }

  async create(
    organizationId: string,
    data: {
      name: string;
      description: string;
      targetClientType?: string;
      minBudget?: number;
      maxBudget?: number;
      typicalTimeline?: string;
      technologies?: string[];
      talkingPoints?: string[];
    }
  ) {
    const existing = await prisma.service.findFirst({
      where: { organizationId, name: data.name },
    });
    if (existing) throw new ValidationError("Service name already exists");

    return prisma.service.create({
      data: {
        organizationId,
        name: data.name,
        description: data.description,
        targetClientType: data.targetClientType,
        minBudget: data.minBudget,
        maxBudget: data.maxBudget,
        typicalTimeline: data.typicalTimeline,
        technologies: data.technologies ?? [],
        talkingPoints: (data.talkingPoints ?? []) as Prisma.InputJsonValue,
      },
    });
  }

  async update(
    organizationId: string,
    id: string,
    data: Partial<{
      name: string;
      description: string;
      targetClientType: string;
      minBudget: number;
      maxBudget: number;
      typicalTimeline: string;
      technologies: string[];
      talkingPoints: string[];
      isActive: boolean;
    }>
  ) {
    const service = await prisma.service.findFirst({
      where: { id, organizationId },
    });
    if (!service) throw new NotFoundError("Service not found");

    return prisma.service.update({
      where: { id },
      data: {
        ...data,
        ...(data.talkingPoints ? { talkingPoints: data.talkingPoints as Prisma.InputJsonValue } : {}),
      },
    });
  }

  async delete(organizationId: string, id: string) {
    const service = await prisma.service.findFirst({
      where: { id, organizationId },
    });
    if (!service) throw new NotFoundError("Service not found");
    return prisma.service.update({
      where: { id },
      data: { isActive: false },
    });
  }
}

export const serviceCatalogService = new ServiceCatalogService();

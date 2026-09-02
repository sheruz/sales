import prisma from "@/lib/db/prisma";
import { NotFoundError, ValidationError } from "@/lib/api/response";
import type { Prisma } from "@prisma/client";

export class ServiceCatalogService {
  async list(includeInactive = false) {
    return prisma.service.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: "asc" },
    });
  }

  async create(data: {
    name: string;
    description: string;
    targetClientType?: string;
    minBudget?: number;
    maxBudget?: number;
    typicalTimeline?: string;
    technologies?: string[];
    talkingPoints?: string[];
  }) {
    const existing = await prisma.service.findUnique({ where: { name: data.name } });
    if (existing) throw new ValidationError("Service name already exists");

    return prisma.service.create({
      data: {
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
    const service = await prisma.service.findUnique({ where: { id } });
    if (!service) throw new NotFoundError("Service not found");

    return prisma.service.update({
      where: { id },
      data: {
        ...data,
        ...(data.talkingPoints ? { talkingPoints: data.talkingPoints as Prisma.InputJsonValue } : {}),
      },
    });
  }

  async delete(id: string) {
    const service = await prisma.service.findUnique({ where: { id } });
    if (!service) throw new NotFoundError("Service not found");
    return prisma.service.update({
      where: { id },
      data: { isActive: false },
    });
  }
}

export const serviceCatalogService = new ServiceCatalogService();

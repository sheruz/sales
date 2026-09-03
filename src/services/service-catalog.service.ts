import prisma from "@/lib/db/prisma";
import { CatalogItemStatus, type Prisma } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/response";

export type ServiceWriteInput = {
  name: string;
  description: string;
  category?: string;
  pricingModel?: string;
  minBudget?: number | null;
  maxBudget?: number | null;
  currency?: string;
  typicalTimeline?: string;
  targetClientType?: string;
  idealCustomer?: string;
  problemsSolved?: string[];
  technologies?: string[];
  talkingPoints?: string[];
  status?: CatalogItemStatus;
  isActive?: boolean;
};

function syncActive(status?: CatalogItemStatus, isActive?: boolean) {
  if (status) {
    return {
      status,
      isActive: status === CatalogItemStatus.ACTIVE,
    };
  }
  if (typeof isActive === "boolean") {
    return {
      isActive,
      status: isActive ? CatalogItemStatus.ACTIVE : CatalogItemStatus.INACTIVE,
    };
  }
  return {};
}

export class ServiceCatalogService {
  async list(organizationId: string, includeInactive = false) {
    return prisma.service.findMany({
      where: {
        organizationId,
        ...(includeInactive
          ? {}
          : {
              OR: [
                { isActive: true },
                { status: CatalogItemStatus.ACTIVE },
              ],
            }),
      },
      include: {
        serviceCaseStudies: { orderBy: { createdAt: "desc" }, take: 5 },
      },
      orderBy: { name: "asc" },
    });
  }

  async getById(organizationId: string, id: string) {
    const service = await prisma.service.findFirst({
      where: { id, organizationId },
      include: { serviceCaseStudies: { orderBy: { createdAt: "desc" } } },
    });
    if (!service) throw new NotFoundError("Service not found");
    return service;
  }

  async create(organizationId: string, data: ServiceWriteInput) {
    const existing = await prisma.service.findFirst({
      where: { organizationId, name: data.name },
    });
    if (existing) throw new ValidationError("Service name already exists");

    const active = syncActive(data.status, data.isActive);

    return prisma.service.create({
      data: {
        organizationId,
        name: data.name.trim(),
        description: data.description,
        category: data.category,
        pricingModel: data.pricingModel,
        minBudget: data.minBudget,
        maxBudget: data.maxBudget,
        currency: data.currency ?? "USD",
        typicalTimeline: data.typicalTimeline,
        targetClientType: data.targetClientType ?? data.idealCustomer,
        idealCustomer: data.idealCustomer ?? data.targetClientType,
        problemsSolved: data.problemsSolved ?? [],
        technologies: data.technologies ?? [],
        talkingPoints: (data.talkingPoints ?? []) as Prisma.InputJsonValue,
        status: active.status ?? CatalogItemStatus.ACTIVE,
        isActive: active.isActive ?? true,
      },
    });
  }

  async update(
    organizationId: string,
    id: string,
    data: Partial<ServiceWriteInput>
  ) {
    const service = await prisma.service.findFirst({
      where: { id, organizationId },
    });
    if (!service) throw new NotFoundError("Service not found");

    const active = syncActive(data.status, data.isActive);

    return prisma.service.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        description: data.description,
        category: data.category,
        pricingModel: data.pricingModel,
        minBudget: data.minBudget,
        maxBudget: data.maxBudget,
        currency: data.currency,
        typicalTimeline: data.typicalTimeline,
        targetClientType: data.targetClientType ?? data.idealCustomer,
        idealCustomer: data.idealCustomer ?? data.targetClientType,
        problemsSolved: data.problemsSolved,
        technologies: data.technologies,
        ...(data.talkingPoints
          ? { talkingPoints: data.talkingPoints as Prisma.InputJsonValue }
          : {}),
        ...active,
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
      data: { isActive: false, status: CatalogItemStatus.INACTIVE },
    });
  }

  async addCaseStudy(
    organizationId: string,
    serviceId: string,
    data: {
      title: string;
      customerIndustry?: string;
      problem?: string;
      solution?: string;
      outcome?: string;
      metrics?: unknown;
      content?: string;
    }
  ) {
    await this.getById(organizationId, serviceId);
    return prisma.serviceCaseStudy.create({
      data: {
        organizationId,
        serviceId,
        title: data.title.trim(),
        customerIndustry: data.customerIndustry,
        problem: data.problem,
        solution: data.solution,
        outcome: data.outcome,
        metrics: data.metrics as Prisma.InputJsonValue | undefined,
        content: data.content,
      },
    });
  }

  async deleteCaseStudy(organizationId: string, caseStudyId: string) {
    const row = await prisma.serviceCaseStudy.findFirst({
      where: { id: caseStudyId, organizationId },
    });
    if (!row) throw new NotFoundError("Case study not found");
    await prisma.serviceCaseStudy.delete({ where: { id: caseStudyId } });
  }
}

export const serviceCatalogService = new ServiceCatalogService();

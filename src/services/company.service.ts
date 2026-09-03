import prisma from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/api/response";
import type { CreateCompanyInput } from "@/lib/validations/lead";

export class CompanyService {
  async list(organizationId: string, search?: string) {
    return prisma.company.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(search
          ? { name: { contains: search, mode: "insensitive" as const } }
          : {}),
      },
      orderBy: { name: "asc" },
      take: 50,
    });
  }

  async getById(organizationId: string, id: string) {
    const company = await prisma.company.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        leads: {
          where: { deletedAt: null, organizationId },
          take: 10,
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!company) throw new NotFoundError("Company not found");
    return company;
  }

  async create(organizationId: string, input: CreateCompanyInput) {
    return prisma.company.create({
      data: {
        organizationId,
        name: input.name,
        website: input.website || null,
        linkedInUrl: input.linkedInUrl || null,
        industry: input.industry || null,
        size: input.size || null,
        description: input.description || null,
        country: input.country || null,
        city: input.city || null,
      },
    });
  }

  async findOrCreate(
    organizationId: string,
    name: string,
    data?: Partial<CreateCompanyInput>
  ) {
    const existing = await prisma.company.findFirst({
      where: {
        organizationId,
        name: { equals: name, mode: "insensitive" },
        deletedAt: null,
      },
    });
    if (existing) return existing;

    return prisma.company.create({
      data: {
        organizationId,
        name,
        website: data?.website || null,
        linkedInUrl: data?.linkedInUrl || null,
        industry: data?.industry || null,
        size: data?.size || null,
        description: data?.description || null,
        country: data?.country || null,
        city: data?.city || null,
      },
    });
  }
}

export const companyService = new CompanyService();

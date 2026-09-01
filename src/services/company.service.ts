import prisma from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/api/response";
import type { CreateCompanyInput } from "@/lib/validations/lead";

export class CompanyService {
  async list(search?: string) {
    return prisma.company.findMany({
      where: {
        deletedAt: null,
        ...(search
          ? { name: { contains: search, mode: "insensitive" as const } }
          : {}),
      },
      orderBy: { name: "asc" },
      take: 50,
    });
  }

  async getById(id: string) {
    const company = await prisma.company.findFirst({
      where: { id, deletedAt: null },
      include: {
        leads: {
          where: { deletedAt: null },
          take: 10,
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!company) throw new NotFoundError("Company not found");
    return company;
  }

  async create(input: CreateCompanyInput) {
    return prisma.company.create({
      data: {
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

  async findOrCreate(name: string, data?: Partial<CreateCompanyInput>) {
    const existing = await prisma.company.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, deletedAt: null },
    });
    if (existing) return existing;

    return prisma.company.create({
      data: {
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

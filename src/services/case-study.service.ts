import prisma from "@/lib/db/prisma";
import { OfferStatus } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/response";

export type CaseStudyInput = {
  clientType: string;
  problem: string;
  whatBuilt: string;
  result: string;
  status?: OfferStatus;
};

export class CaseStudyService {
  async list(organizationId: string, includeArchived = false) {
    return prisma.caseStudy.findMany({
      where: {
        organizationId,
        ...(includeArchived ? {} : { status: OfferStatus.ACTIVE }),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getById(organizationId: string, id: string) {
    const row = await prisma.caseStudy.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundError("Case study not found");
    return row;
  }

  async create(organizationId: string, input: CaseStudyInput) {
    if (!input.clientType.trim()) {
      throw new ValidationError("Client type is required");
    }
    if (!input.problem.trim() || !input.whatBuilt.trim() || !input.result.trim()) {
      throw new ValidationError("Problem, what built, and result are required");
    }
    return prisma.caseStudy.create({
      data: {
        organizationId,
        clientType: input.clientType.trim(),
        problem: input.problem.trim(),
        whatBuilt: input.whatBuilt.trim(),
        result: input.result.trim(),
        status: input.status ?? OfferStatus.ACTIVE,
      },
    });
  }

  async update(
    organizationId: string,
    id: string,
    input: Partial<CaseStudyInput>
  ) {
    await this.getById(organizationId, id);
    return prisma.caseStudy.update({
      where: { id },
      data: {
        ...(input.clientType != null
          ? { clientType: input.clientType.trim() }
          : {}),
        ...(input.problem != null ? { problem: input.problem.trim() } : {}),
        ...(input.whatBuilt != null
          ? { whatBuilt: input.whatBuilt.trim() }
          : {}),
        ...(input.result != null ? { result: input.result.trim() } : {}),
        ...(input.status != null ? { status: input.status } : {}),
      },
    });
  }

  async archive(organizationId: string, id: string) {
    await this.getById(organizationId, id);
    return prisma.caseStudy.update({
      where: { id },
      data: { status: OfferStatus.ARCHIVED },
    });
  }

  async firstActive(organizationId: string) {
    return prisma.caseStudy.findFirst({
      where: { organizationId, status: OfferStatus.ACTIVE },
      orderBy: { updatedAt: "desc" },
    });
  }
}

export const caseStudyService = new CaseStudyService();

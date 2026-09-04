import prisma from "@/lib/db/prisma";
import {
  OpportunityEventType,
  OpportunityStage,
  ProposalStatus,
} from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/response";
import { opportunityService } from "@/services/opportunity.service";
import { dealService } from "@/services/deal.service";

export class ProposalService {
  async list(organizationId: string, filters?: { opportunityId?: string }) {
    return prisma.proposal.findMany({
      where: {
        organizationId,
        ...(filters?.opportunityId
          ? { opportunityId: filters.opportunityId }
          : {}),
      },
      include: {
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, fullName: true } },
        opportunity: { select: { id: true, stage: true } },
        deal: { select: { id: true, name: true, stage: true } },
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  }

  async getById(organizationId: string, id: string) {
    const proposal = await prisma.proposal.findFirst({
      where: { id, organizationId },
      include: {
        company: true,
        contact: true,
        opportunity: true,
        deal: true,
        lead: { select: { id: true, fullName: true } },
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        versions: { orderBy: { version: "desc" } },
      },
    });
    if (!proposal) throw new NotFoundError("Proposal not found");
    return proposal;
  }

  async create(
    organizationId: string,
    input: {
      title: string;
      content?: string | null;
      currency?: string;
      subtotal?: number | null;
      discount?: number | null;
      total?: number | null;
      opportunityId?: string | null;
      companyId?: string | null;
      contactId?: string | null;
      leadId?: string | null;
      dealId?: string | null;
      expiresAt?: string | null;
      advanceOpportunity?: boolean;
    },
    userId: string
  ) {
    if (!input.title.trim()) throw new ValidationError("Proposal title required");

    let companyId = input.companyId;
    let contactId = input.contactId;
    let leadId = input.leadId;
    let dealId = input.dealId;
    let currency = input.currency ?? "USD";

    if (input.opportunityId) {
      const opp = await prisma.opportunity.findFirst({
        where: { id: input.opportunityId, organizationId },
      });
      if (!opp) throw new NotFoundError("Opportunity not found");
      companyId = companyId ?? opp.companyId;
      contactId = contactId ?? opp.primaryContactId;
      leadId = leadId ?? opp.leadId;
      currency = input.currency ?? opp.currency;
      const deal = await dealService.ensureForOpportunity(
        organizationId,
        input.opportunityId,
        userId
      );
      dealId = dealId ?? deal.id;
    }

    const subtotal = input.subtotal ?? input.total ?? null;
    const discount = input.discount ?? 0;
    const total =
      input.total ??
      (subtotal != null ? Math.max(0, Number(subtotal) - Number(discount)) : null);

    const proposal = await prisma.proposal.create({
      data: {
        organizationId,
        createdById: userId,
        title: input.title.trim(),
        content: input.content,
        currency,
        subtotal,
        discount,
        totalPrice: total,
        opportunityId: input.opportunityId,
        companyId,
        contactId,
        leadId,
        dealId,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        version: 1,
        status: ProposalStatus.DRAFT,
        versions: input.content
          ? {
              create: {
                version: 1,
                rawContent: { content: input.content },
                executiveSummary: input.content.slice(0, 500),
              },
            }
          : undefined,
      },
      include: { versions: true },
    });

    if (input.opportunityId && input.advanceOpportunity !== false) {
      await opportunityService.update(
        organizationId,
        input.opportunityId,
        { stage: OpportunityStage.PROPOSAL },
        userId
      );
    }

    return proposal;
  }

  async updateStatus(
    organizationId: string,
    id: string,
    status: ProposalStatus,
    userId?: string
  ) {
    const proposal = await this.getById(organizationId, id);
    const data: {
      status: ProposalStatus;
      sentAt?: Date;
      viewedAt?: Date;
      acceptedAt?: Date;
    } = { status };

    if (status === ProposalStatus.SENT) data.sentAt = new Date();
    if (status === ProposalStatus.VIEWED) data.viewedAt = new Date();
    if (status === ProposalStatus.ACCEPTED) data.acceptedAt = new Date();

    const updated = await prisma.proposal.update({
      where: { id },
      data,
    });

    if (proposal.opportunityId) {
      if (status === ProposalStatus.SENT) {
        await opportunityService.addEvent(
          organizationId,
          proposal.opportunityId,
          OpportunityEventType.PROPOSAL_SENT,
          {
            title: `Proposal sent: ${proposal.title}`,
            actorId: userId,
            metadata: { proposalId: id },
          }
        );
        await opportunityService.update(
          organizationId,
          proposal.opportunityId,
          { stage: OpportunityStage.PROPOSAL },
          userId
        );
      }
      if (status === ProposalStatus.ACCEPTED) {
        await opportunityService.update(
          organizationId,
          proposal.opportunityId,
          { stage: OpportunityStage.NEGOTIATION },
          userId
        );
      }
    }

    return updated;
  }
}

export const proposalService = new ProposalService();

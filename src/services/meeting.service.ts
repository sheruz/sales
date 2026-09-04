import prisma from "@/lib/db/prisma";
import {
  MeetingOutcome,
  MeetingType,
  OpportunityEventType,
  OpportunityStage,
} from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/response";
import { opportunityService } from "@/services/opportunity.service";
import { dealService } from "@/services/deal.service";

export class MeetingService {
  async list(
    organizationId: string,
    filters?: { opportunityId?: string; upcoming?: boolean }
  ) {
    return prisma.meeting.findMany({
      where: {
        organizationId,
        ...(filters?.opportunityId
          ? { opportunityId: filters.opportunityId }
          : {}),
        ...(filters?.upcoming
          ? { date: { gte: new Date() }, outcome: MeetingOutcome.SCHEDULED }
          : {}),
      },
      include: {
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, fullName: true, email: true } },
        opportunity: { select: { id: true, stage: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { date: "asc" },
      take: 100,
    });
  }

  async getById(organizationId: string, id: string) {
    const meeting = await prisma.meeting.findFirst({
      where: { id, organizationId },
      include: {
        company: true,
        contact: true,
        opportunity: true,
        lead: { select: { id: true, fullName: true } },
        deal: true,
        user: { select: { id: true, firstName: true, lastName: true } },
        meetingNotes: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!meeting) throw new NotFoundError("Meeting not found");
    return meeting;
  }

  async create(
    organizationId: string,
    input: {
      title: string;
      description?: string | null;
      startAt: string;
      endAt?: string | null;
      durationMinutes?: number;
      timezone?: string;
      location?: string | null;
      meetingUrl?: string | null;
      type?: MeetingType;
      opportunityId?: string | null;
      companyId?: string | null;
      contactId?: string | null;
      leadId?: string | null;
      dealId?: string | null;
      notes?: string | null;
      advanceOpportunity?: boolean;
    },
    userId: string
  ) {
    if (!input.title.trim()) throw new ValidationError("Meeting title required");
    const start = new Date(input.startAt);
    if (Number.isNaN(start.getTime())) {
      throw new ValidationError("Invalid start time");
    }
    const duration = input.durationMinutes ?? 30;
    const endAt = input.endAt
      ? new Date(input.endAt)
      : new Date(start.getTime() + duration * 60_000);

    let companyId = input.companyId;
    let contactId = input.contactId;
    let leadId = input.leadId;
    let dealId = input.dealId;

    if (input.opportunityId) {
      const opp = await prisma.opportunity.findFirst({
        where: { id: input.opportunityId, organizationId },
      });
      if (!opp) throw new NotFoundError("Opportunity not found");
      companyId = companyId ?? opp.companyId;
      contactId = contactId ?? opp.primaryContactId;
      leadId = leadId ?? opp.leadId;
      const deal = await dealService.ensureForOpportunity(
        organizationId,
        input.opportunityId,
        userId
      );
      dealId = dealId ?? deal.id;
    }

    const meeting = await prisma.meeting.create({
      data: {
        organizationId,
        userId,
        title: input.title.trim(),
        description: input.description,
        date: start,
        endAt,
        duration,
        timezone: input.timezone ?? "UTC",
        location: input.location,
        meetingLink: input.meetingUrl,
        type: input.type ?? MeetingType.DISCOVERY,
        opportunityId: input.opportunityId,
        companyId,
        contactId,
        leadId,
        dealId,
        notes: input.notes,
        outcome: MeetingOutcome.SCHEDULED,
      },
    });

    if (input.opportunityId && input.advanceOpportunity !== false) {
      await opportunityService.update(
        organizationId,
        input.opportunityId,
        { stage: OpportunityStage.MEETING },
        userId
      );
      await opportunityService.addEvent(
        organizationId,
        input.opportunityId,
        OpportunityEventType.MEETING_BOOKED,
        {
          title: `Meeting booked: ${meeting.title}`,
          actorId: userId,
          metadata: { meetingId: meeting.id },
        }
      );
    }

    return meeting;
  }

  async update(
    organizationId: string,
    id: string,
    input: Partial<{
      title: string;
      description: string | null;
      startAt: string;
      endAt: string | null;
      timezone: string;
      location: string | null;
      meetingUrl: string | null;
      outcome: MeetingOutcome;
      notes: string | null;
      type: MeetingType;
    }>
  ) {
    await this.getById(organizationId, id);
    return prisma.meeting.update({
      where: { id },
      data: {
        title: input.title?.trim(),
        description: input.description,
        date: input.startAt ? new Date(input.startAt) : undefined,
        endAt:
          input.endAt === undefined
            ? undefined
            : input.endAt
              ? new Date(input.endAt)
              : null,
        timezone: input.timezone,
        location: input.location,
        meetingLink: input.meetingUrl,
        outcome: input.outcome,
        notes: input.notes,
        type: input.type,
      },
    });
  }
}

export const meetingService = new MeetingService();

import prisma from "@/lib/db/prisma";
import { ActivityType, LeadStatus } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/response";
import { activityService } from "@/services/activity.service";
import { companyService } from "@/services/company.service";
import type {
  BulkLeadAction,
  CreateLeadInput,
  LeadListQuery,
  UpdateLeadInput,
} from "@/lib/validations/lead";
import { LEAD_STATUS_LABELS } from "@/lib/constants/leads";

const leadInclude = {
  assignedTo: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  createdBy: {
    select: { id: true, firstName: true, lastName: true },
  },
  company: true,
  tags: { include: { tag: true } },
  _count: { select: { leadNotes: true, tasks: true, activities: true } },
} as const;

function emptyToNull(value?: string | null) {
  return value && value.trim() !== "" ? value.trim() : null;
}

export class LeadService {
  async list(query: LeadListQuery) {
    const { page, limit, search, status, assignedToId, tagId, source, sortBy, sortOrder } =
      query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(assignedToId ? { assignedToId } : {}),
      ...(source ? { source } : {}),
      ...(tagId ? { tags: { some: { tagId } } } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
              { companyName: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: leadInclude,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.lead.count({ where }),
    ]);

    return {
      leads,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    const lead = await prisma.lead.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...leadInclude,
        leadNotes: {
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        tasks: {
          orderBy: { dueDate: "asc" },
          include: {
            assignedTo: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        researches: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (!lead) throw new NotFoundError("Lead not found");
    return lead;
  }

  async create(input: CreateLeadInput, userId: string) {
    let companyId: string | null = null;
    if (input.companyName) {
      const company = await companyService.findOrCreate(input.companyName, {
        website: input.companyWebsite || undefined,
        linkedInUrl: input.companyLinkedIn || undefined,
        industry: input.industry || undefined,
        size: input.companySize || undefined,
        description: input.companyDescription || undefined,
        country: input.country || undefined,
        city: input.city || undefined,
      });
      companyId = company.id;
    }

    const lead = await prisma.lead.create({
      data: {
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        fullName: `${input.firstName.trim()} ${input.lastName.trim()}`,
        email: emptyToNull(input.email),
        phone: emptyToNull(input.phone),
        linkedInUrl: emptyToNull(input.linkedInUrl),
        companyName: emptyToNull(input.companyName),
        companyWebsite: emptyToNull(input.companyWebsite),
        companyLinkedIn: emptyToNull(input.companyLinkedIn),
        jobTitle: emptyToNull(input.jobTitle),
        country: emptyToNull(input.country),
        city: emptyToNull(input.city),
        industry: emptyToNull(input.industry),
        companySize: emptyToNull(input.companySize),
        companyDescription: emptyToNull(input.companyDescription),
        source: emptyToNull(input.source) ?? "Manual",
        campaignId: input.campaignId ?? null,
        companyId,
        assignedToId: input.assignedToId ?? userId,
        createdById: userId,
        status: input.status ?? LeadStatus.NEW,
        estimatedBudget: input.estimatedBudget ?? null,
        notes: emptyToNull(input.notes),
        ...(input.tagIds?.length
          ? { tags: { create: input.tagIds.map((tagId) => ({ tagId })) } }
          : {}),
      },
      include: leadInclude,
    });

    await activityService.log({
      leadId: lead.id,
      userId,
      type: ActivityType.LEAD_CREATED,
      title: "Lead created",
      description: `${lead.fullName} was added to the CRM`,
    });

    return lead;
  }

  async update(id: string, input: UpdateLeadInput, userId: string) {
    const existing = await prisma.lead.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundError("Lead not found");

    let companyId = existing.companyId;
    if (input.companyName !== undefined) {
      if (input.companyName) {
        const company = await companyService.findOrCreate(input.companyName);
        companyId = company.id;
      } else {
        companyId = null;
      }
    }

    const firstName = input.firstName?.trim() ?? existing.firstName;
    const lastName = input.lastName?.trim() ?? existing.lastName;

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        ...(input.firstName !== undefined || input.lastName !== undefined
          ? { firstName, lastName, fullName: `${firstName} ${lastName}` }
          : {}),
        ...(input.email !== undefined ? { email: emptyToNull(input.email) } : {}),
        ...(input.phone !== undefined ? { phone: emptyToNull(input.phone) } : {}),
        ...(input.linkedInUrl !== undefined
          ? { linkedInUrl: emptyToNull(input.linkedInUrl) }
          : {}),
        ...(input.companyName !== undefined
          ? { companyName: emptyToNull(input.companyName), companyId }
          : {}),
        ...(input.companyWebsite !== undefined
          ? { companyWebsite: emptyToNull(input.companyWebsite) }
          : {}),
        ...(input.companyLinkedIn !== undefined
          ? { companyLinkedIn: emptyToNull(input.companyLinkedIn) }
          : {}),
        ...(input.jobTitle !== undefined
          ? { jobTitle: emptyToNull(input.jobTitle) }
          : {}),
        ...(input.country !== undefined ? { country: emptyToNull(input.country) } : {}),
        ...(input.city !== undefined ? { city: emptyToNull(input.city) } : {}),
        ...(input.industry !== undefined
          ? { industry: emptyToNull(input.industry) }
          : {}),
        ...(input.companySize !== undefined
          ? { companySize: emptyToNull(input.companySize) }
          : {}),
        ...(input.companyDescription !== undefined
          ? { companyDescription: emptyToNull(input.companyDescription) }
          : {}),
        ...(input.source !== undefined ? { source: emptyToNull(input.source) } : {}),
        ...(input.campaignId !== undefined ? { campaignId: input.campaignId } : {}),
        ...(input.assignedToId !== undefined
          ? { assignedToId: input.assignedToId }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.estimatedBudget !== undefined
          ? { estimatedBudget: input.estimatedBudget }
          : {}),
        ...(input.notes !== undefined ? { notes: emptyToNull(input.notes) } : {}),
      },
      include: leadInclude,
    });

    if (input.status && input.status !== existing.status) {
      await activityService.log({
        leadId: id,
        userId,
        type: ActivityType.STATUS_CHANGED,
        title: "Status changed",
        description: `${LEAD_STATUS_LABELS[existing.status]} → ${LEAD_STATUS_LABELS[input.status]}`,
        metadata: { from: existing.status, to: input.status },
      });
    }

    if (input.assignedToId && input.assignedToId !== existing.assignedToId) {
      await activityService.log({
        leadId: id,
        userId,
        type: ActivityType.LEAD_ASSIGNED,
        title: "Lead reassigned",
        metadata: { assignedToId: input.assignedToId },
      });
    }

    if (!input.status && !input.assignedToId) {
      await activityService.log({
        leadId: id,
        userId,
        type: ActivityType.LEAD_UPDATED,
        title: "Lead updated",
      });
    }

    if (input.tagIds) {
      await prisma.leadTag.deleteMany({ where: { leadId: id } });
      if (input.tagIds.length > 0) {
        await prisma.leadTag.createMany({
          data: input.tagIds.map((tagId) => ({ leadId: id, tagId })),
        });
      }
    }

    return lead;
  }

  async delete(id: string, userId: string) {
    const existing = await prisma.lead.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundError("Lead not found");

    await prisma.lead.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await activityService.log({
      leadId: id,
      userId,
      type: ActivityType.LEAD_UPDATED,
      title: "Lead deleted",
    });
  }

  async bulkAction(input: BulkLeadAction, userId: string) {
    const { leadIds, action } = input;

    switch (action) {
      case "delete":
        await prisma.lead.updateMany({
          where: { id: { in: leadIds }, deletedAt: null },
          data: { deletedAt: new Date() },
        });
        break;
      case "assign":
        if (!input.assignedToId) throw new ValidationError("assignedToId required");
        await prisma.lead.updateMany({
          where: { id: { in: leadIds }, deletedAt: null },
          data: { assignedToId: input.assignedToId },
        });
        break;
      case "updateStatus":
        if (!input.status) throw new ValidationError("status required");
        await prisma.lead.updateMany({
          where: { id: { in: leadIds }, deletedAt: null },
          data: { status: input.status },
        });
        break;
      case "addTag":
        if (!input.tagId) throw new ValidationError("tagId required");
        await prisma.leadTag.createMany({
          data: leadIds.map((leadId) => ({ leadId, tagId: input.tagId! })),
          skipDuplicates: true,
        });
        break;
    }

    await activityService.log({
      userId,
      type: ActivityType.LEAD_UPDATED,
      title: `Bulk action: ${action}`,
      metadata: { leadIds, action },
    });

    return { affected: leadIds.length };
  }

  async importFromCsv(
    rows: Record<string, string>[],
    userId: string
  ): Promise<{ created: number; errors: string[] }> {
    let created = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const firstName = row.firstName || row.first_name || row.FirstName;
        const lastName = row.lastName || row.last_name || row.LastName;

        if (!firstName || !lastName) {
          errors.push(`Row ${i + 1}: firstName and lastName are required`);
          continue;
        }

        await this.create(
          {
            firstName,
            lastName,
            email: row.email || row.Email || "",
            phone: row.phone || row.Phone || "",
            companyName: row.companyName || row.company || row.Company || "",
            jobTitle: row.jobTitle || row.title || row.Title || "",
            country: row.country || row.Country || "",
            city: row.city || row.City || "",
            industry: row.industry || row.Industry || "",
            source: "CSV Import",
            linkedInUrl: row.linkedInUrl || row.linkedin || "",
            companyWebsite: row.companyWebsite || row.website || "",
          },
          userId
        );
        created++;
      } catch (err) {
        errors.push(
          `Row ${i + 1}: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }
    }

    return { created, errors };
  }
}

export const leadService = new LeadService();

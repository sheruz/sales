import prisma from "@/lib/db/prisma";
import { ContactStatus, type Prisma } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/response";

export function normalizeEmail(email?: string | null): string | null {
  if (!email?.trim()) return null;
  return email.trim().toLowerCase();
}

export type ContactWriteInput = {
  companyId: string;
  firstName: string;
  lastName: string;
  title?: string | null;
  department?: string | null;
  seniority?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedInUrl?: string | null;
  source?: string | null;
  status?: ContactStatus;
  /** LEGACY bridge only — optional */
  leadId?: string | null;
};

export type ContactListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  companyId?: string;
};

export class ContactService {
  async list(organizationId: string, query: ContactListQuery = {}) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));
    const skip = (page - 1) * limit;

    if (query.companyId) {
      const company = await prisma.company.findFirst({
        where: {
          id: query.companyId,
          organizationId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!company) throw new NotFoundError("Company not found");
    }

    const where: Prisma.ContactWhereInput = {
      organizationId,
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } },
              { title: { contains: query.search, mode: "insensitive" } },
              {
                company: {
                  name: { contains: query.search, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
        include: {
          company: {
            select: { id: true, name: true, domain: true },
          },
          _count: {
            select: {
              primaryOpportunities: true,
              meetings: true,
              inboxConversations: true,
            },
          },
        },
      }),
      prisma.contact.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getById(organizationId: string, id: string) {
    const contact = await prisma.contact.findFirst({
      where: { id, organizationId },
      include: {
        company: true,
        primaryOpportunities: {
          orderBy: { updatedAt: "desc" },
          take: 20,
          include: {
            primarySignal: { select: { id: true, title: true } },
          },
        },
        inboxConversations: {
          orderBy: { lastMessageAt: "desc" },
          take: 20,
        },
        meetings: { orderBy: { date: "desc" }, take: 20 },
        lead: {
          select: { id: true, fullName: true, email: true, status: true },
        },
      },
    });
    if (!contact) throw new NotFoundError("Contact not found");
    return contact;
  }

  async create(organizationId: string, input: ContactWriteInput) {
    const company = await prisma.company.findFirst({
      where: {
        id: input.companyId,
        organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!company) {
      throw new ValidationError("Company not found in your organization");
    }

    if (input.leadId) {
      const lead = await prisma.lead.findFirst({
        where: {
          id: input.leadId,
          organizationId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!lead) throw new ValidationError("Lead not found in your organization");
    }

    const email = input.email?.trim() || null;
    const normalizedEmail = normalizeEmail(email);
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    const fullName = `${firstName} ${lastName}`.trim();

    if (normalizedEmail) {
      const dup = await prisma.contact.findFirst({
        where: {
          organizationId,
          companyId: input.companyId,
          normalizedEmail,
        },
      });
      if (dup) {
        throw new ValidationError(
          "A contact with this email already exists at this company"
        );
      }
    }

    return prisma.contact.create({
      data: {
        organizationId,
        companyId: input.companyId,
        firstName,
        lastName,
        fullName,
        title: input.title || null,
        department: input.department || null,
        seniority: input.seniority || null,
        email,
        normalizedEmail,
        phone: input.phone || null,
        linkedInUrl: input.linkedInUrl || null,
        source: input.source || "manual",
        status: input.status ?? ContactStatus.ACTIVE,
        leadId: input.leadId || null,
      },
      include: {
        company: { select: { id: true, name: true, domain: true } },
      },
    });
  }

  async update(
    organizationId: string,
    id: string,
    input: Partial<Omit<ContactWriteInput, "companyId">> & {
      companyId?: string;
    }
  ) {
    const existing = await prisma.contact.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundError("Contact not found");

    let companyId = existing.companyId;
    if (input.companyId && input.companyId !== existing.companyId) {
      const company = await prisma.company.findFirst({
        where: {
          id: input.companyId,
          organizationId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!company) {
        throw new ValidationError("Company not found in your organization");
      }
      companyId = company.id;
    }

    const email =
      input.email !== undefined
        ? input.email?.trim() || null
        : existing.email;
    const normalizedEmail = normalizeEmail(email);

    if (normalizedEmail) {
      const dup = await prisma.contact.findFirst({
        where: {
          organizationId,
          companyId,
          normalizedEmail,
          NOT: { id },
        },
      });
      if (dup) {
        throw new ValidationError(
          "A contact with this email already exists at this company"
        );
      }
    }

    const firstName = input.firstName?.trim() ?? existing.firstName;
    const lastName = input.lastName?.trim() ?? existing.lastName;

    return prisma.contact.update({
      where: { id },
      data: {
        companyId,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`.trim(),
        ...(input.title !== undefined ? { title: input.title || null } : {}),
        ...(input.department !== undefined
          ? { department: input.department || null }
          : {}),
        ...(input.seniority !== undefined
          ? { seniority: input.seniority || null }
          : {}),
        ...(input.email !== undefined ? { email, normalizedEmail } : {}),
        ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
        ...(input.linkedInUrl !== undefined
          ? { linkedInUrl: input.linkedInUrl || null }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      include: {
        company: { select: { id: true, name: true, domain: true } },
      },
    });
  }

  /** Idempotent find-or-create within org+company by normalized email or name. */
  async findOrCreate(
    organizationId: string,
    companyId: string,
    input: {
      firstName: string;
      lastName: string;
      email?: string | null;
      title?: string | null;
      phone?: string | null;
      linkedInUrl?: string | null;
      source?: string | null;
      leadId?: string | null;
    }
  ) {
    const company = await prisma.company.findFirst({
      where: { id: companyId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!company) throw new ValidationError("Company not found");

    const normalizedEmail = normalizeEmail(input.email);
    if (normalizedEmail) {
      const byEmail = await prisma.contact.findFirst({
        where: { organizationId, companyId, normalizedEmail },
      });
      if (byEmail) {
        if (input.leadId && !byEmail.leadId) {
          return prisma.contact.update({
            where: { id: byEmail.id },
            data: { leadId: input.leadId },
          });
        }
        return byEmail;
      }
    }

    return this.create(organizationId, {
      companyId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      title: input.title,
      phone: input.phone,
      linkedInUrl: input.linkedInUrl,
      source: input.source,
      leadId: input.leadId,
    });
  }
}

export const contactService = new ContactService();

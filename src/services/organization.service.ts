import prisma from "@/lib/db/prisma";
import {
  InvitationStatus,
  MembershipStatus,
  OrganizationStatus,
  UserRole,
} from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/response";
import { hashPassword } from "@/lib/auth/password";
import {
  ensureUniqueOrgSlug,
  generateInviteToken,
  getRoleByKey,
  hashInviteToken,
  mapLegacyRole,
  seedRolesAndPermissions,
} from "@/lib/tenant/rbac";
import { ROLE_KEYS } from "@/lib/auth/permission-catalog";
import { deleteUserSessions } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { entitlementService } from "@/services/entitlement.service";
import { FEATURE_KEYS } from "@/lib/billing/features";

export class OrganizationService {
  async ensureRbacSeeded() {
    await seedRolesAndPermissions();
  }

  async listOrganizations() {
    return prisma.organization.findMany({
      where: { deletedAt: null },
      include: {
        _count: {
          select: {
            members: true,
            leads: true,
            campaigns: true,
          },
        },
        settings: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getOrganization(id: string) {
    const org = await prisma.organization.findFirst({
      where: { id, deletedAt: null },
      include: {
        settings: true,
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true,
              },
            },
            role: true,
          },
        },
        _count: { select: { leads: true, campaigns: true, services: true } },
      },
    });
    if (!org) throw new NotFoundError("Organization not found");
    return org;
  }

  async createOrganization(input: {
    name: string;
    slug?: string;
    website?: string;
    legalName?: string;
    timezone?: string;
    defaultCurrency?: string;
    admin?: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    };
  }) {
    await this.ensureRbacSeeded();
    const slug = await ensureUniqueOrgSlug(input.slug ?? input.name);
    const companyAdminRole = await getRoleByKey(ROLE_KEYS.COMPANY_ADMIN);

    const org = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          name: input.name.trim(),
          slug,
          website: input.website,
          legalName: input.legalName,
          timezone: input.timezone ?? "UTC",
          defaultCurrency: input.defaultCurrency ?? "USD",
          status: OrganizationStatus.ACTIVE,
          settings: {
            create: {
              timezone: input.timezone ?? "UTC",
              currency: input.defaultCurrency ?? "USD",
            },
          },
        },
      });

      if (input.admin) {
        const email = input.admin.email.toLowerCase().trim();
        const existing = await tx.user.findUnique({ where: { email } });
        if (existing) {
          throw new ValidationError("Admin email already in use");
        }
        const passwordHash = await hashPassword(input.admin.password);
        const admin = await tx.user.create({
          data: {
            email,
            passwordHash,
            firstName: input.admin.firstName,
            lastName: input.admin.lastName,
            role: UserRole.ADMIN,
          },
        });
        await tx.organizationUser.create({
          data: {
            organizationId: created.id,
            userId: admin.id,
            roleId: companyAdminRole.id,
            status: MembershipStatus.ACTIVE,
            isPrimaryAdmin: true,
            joinedAt: new Date(),
          },
        });
      }

      return created;
    });

    await entitlementService.ensureSubscription(org.id);
    return org;
  }

  async updateOrganization(
    id: string,
    data: {
      name?: string;
      website?: string | null;
      legalName?: string | null;
      status?: OrganizationStatus;
      timezone?: string;
      defaultCurrency?: string;
    }
  ) {
    const org = await prisma.organization.findFirst({
      where: { id, deletedAt: null },
    });
    if (!org) throw new NotFoundError("Organization not found");

    return prisma.organization.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        website: data.website,
        legalName: data.legalName,
        status: data.status,
        timezone: data.timezone,
        defaultCurrency: data.defaultCurrency,
      },
    });
  }

  async suspendOrganization(id: string) {
    return this.updateOrganization(id, { status: OrganizationStatus.SUSPENDED });
  }

  async activateOrganization(id: string) {
    return this.updateOrganization(id, { status: OrganizationStatus.ACTIVE });
  }

  async listMembers(organizationId: string) {
    return prisma.organizationUser.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        role: true,
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async inviteMember(input: {
    organizationId: string;
    email: string;
    roleKey: string;
    invitedById: string;
    expiresInDays?: number;
  }) {
    await this.ensureRbacSeeded();
    const org = await prisma.organization.findFirst({
      where: { id: input.organizationId, deletedAt: null },
    });
    if (!org) throw new NotFoundError("Organization not found");

    const role = await getRoleByKey(input.roleKey);
    if (role.scope !== "ORGANIZATION") {
      throw new ValidationError("Invalid organization role");
    }

    await entitlementService.assertSeatAvailable(
      input.organizationId,
      FEATURE_KEYS.USERS
    );

    const email = input.email.toLowerCase().trim();
    const token = generateInviteToken();
    const tokenHash = hashInviteToken(token);
    const expiresAt = new Date(
      Date.now() + (input.expiresInDays ?? 7) * 24 * 60 * 60 * 1000
    );

    await prisma.organizationInvitation.create({
      data: {
        organizationId: input.organizationId,
        email,
        roleId: role.id,
        invitedById: input.invitedById,
        tokenHash,
        expiresAt,
        status: InvitationStatus.PENDING,
      },
    });

    logger.info("Organization invite created", {
      organizationId: input.organizationId,
      email,
    });

    // Return raw token once for email/link (never store plaintext)
    return { token, email, expiresAt, organizationSlug: org.slug };
  }

  async acceptInvitation(input: {
    token: string;
    password: string;
    firstName: string;
    lastName: string;
  }) {
    const tokenHash = hashInviteToken(input.token);
    const invite = await prisma.organizationInvitation.findUnique({
      where: { tokenHash },
      include: { role: true, organization: true },
    });

    if (!invite || invite.status !== InvitationStatus.PENDING) {
      throw new ValidationError("Invalid or used invitation");
    }
    if (invite.expiresAt < new Date()) {
      await prisma.organizationInvitation.update({
        where: { id: invite.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      throw new ValidationError("Invitation expired");
    }

    const email = invite.email.toLowerCase();
    const passwordHash = await hashPassword(input.password);

    const user = await prisma.$transaction(async (tx) => {
      let existing = await tx.user.findUnique({ where: { email } });
      if (!existing) {
        existing = await tx.user.create({
          data: {
            email,
            passwordHash,
            firstName: input.firstName,
            lastName: input.lastName,
            role:
              invite.role.key === ROLE_KEYS.COMPANY_ADMIN
                ? UserRole.ADMIN
                : invite.role.key === ROLE_KEYS.SALES_MANAGER
                  ? UserRole.SALES_MANAGER
                  : UserRole.SALES_REPRESENTATIVE,
          },
        });
      } else if (!existing.isActive || existing.deletedAt) {
        throw new ValidationError("Account is deactivated");
      }

      await tx.organizationUser.upsert({
        where: {
          organizationId_userId: {
            organizationId: invite.organizationId,
            userId: existing.id,
          },
        },
        create: {
          organizationId: invite.organizationId,
          userId: existing.id,
          roleId: invite.roleId,
          status: MembershipStatus.ACTIVE,
          invitedAt: invite.createdAt,
          joinedAt: new Date(),
        },
        update: {
          roleId: invite.roleId,
          status: MembershipStatus.ACTIVE,
          joinedAt: new Date(),
        },
      });

      await tx.organizationInvitation.update({
        where: { id: invite.id },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      });

      return existing;
    });

    return {
      userId: user.id,
      organizationId: invite.organizationId,
      organizationSlug: invite.organization.slug,
    };
  }

  async changeMemberRole(
    organizationId: string,
    userId: string,
    roleKey: string
  ) {
    const role = await getRoleByKey(roleKey);
    if (role.scope !== "ORGANIZATION") {
      throw new ValidationError("Invalid organization role");
    }
    const membership = await prisma.organizationUser.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!membership) throw new NotFoundError("Member not found");

    await prisma.organizationUser.update({
      where: { id: membership.id },
      data: { roleId: role.id },
    });

    // Keep legacy User.role in sync for non-platform users
    const legacy =
      roleKey === ROLE_KEYS.COMPANY_ADMIN
        ? UserRole.ADMIN
        : roleKey === ROLE_KEYS.SALES_MANAGER
          ? UserRole.SALES_MANAGER
          : UserRole.SALES_REPRESENTATIVE;
    await prisma.user.update({
      where: { id: userId },
      data: { role: legacy },
    });

    await deleteUserSessions(userId);
  }

  async deactivateMember(organizationId: string, userId: string, actorId: string) {
    if (userId === actorId) {
      throw new ValidationError("Cannot deactivate yourself");
    }
    const membership = await prisma.organizationUser.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!membership) throw new NotFoundError("Member not found");
    if (membership.isPrimaryAdmin) {
      throw new ValidationError("Transfer primary admin before removing");
    }

    await prisma.organizationUser.update({
      where: { id: membership.id },
      data: { status: MembershipStatus.DISABLED },
    });
    await deleteUserSessions(userId);
  }

  async reactivateMember(organizationId: string, userId: string) {
    const membership = await prisma.organizationUser.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!membership) throw new NotFoundError("Member not found");

    await prisma.organizationUser.update({
      where: { id: membership.id },
      data: { status: MembershipStatus.ACTIVE },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: true, deletedAt: null },
    });
  }

  async transferPrimaryAdmin(
    organizationId: string,
    fromUserId: string,
    toUserId: string
  ) {
    if (fromUserId === toUserId) {
      throw new ValidationError("Cannot transfer to the same user");
    }

    const [from, to] = await Promise.all([
      prisma.organizationUser.findUnique({
        where: { organizationId_userId: { organizationId, userId: fromUserId } },
      }),
      prisma.organizationUser.findUnique({
        where: { organizationId_userId: { organizationId, userId: toUserId } },
      }),
    ]);

    if (!from?.isPrimaryAdmin) {
      throw new ValidationError("Only the primary admin can transfer ownership");
    }
    if (!to || to.status !== MembershipStatus.ACTIVE) {
      throw new ValidationError("Target member must be an active organization member");
    }

    const companyAdminRole = await getRoleByKey(ROLE_KEYS.COMPANY_ADMIN);

    await prisma.$transaction([
      prisma.organizationUser.update({
        where: { id: from.id },
        data: { isPrimaryAdmin: false },
      }),
      prisma.organizationUser.update({
        where: { id: to.id },
        data: {
          isPrimaryAdmin: true,
          roleId: companyAdminRole.id,
          status: MembershipStatus.ACTIVE,
        },
      }),
      prisma.user.update({
        where: { id: toUserId },
        data: { role: UserRole.ADMIN },
      }),
    ]);

    await deleteUserSessions(fromUserId);
    await deleteUserSessions(toUserId);
  }

  async writeAudit(input: {
    organizationId?: string | null;
    userId?: string | null;
    action: string;
    entityType: string;
    entityId?: string;
    oldValues?: unknown;
    newValues?: unknown;
    ipAddress?: string;
    userAgent?: string;
  }) {
    await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId ?? null,
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        oldValues: input.oldValues as object | undefined,
        newValues: input.newValues as object | undefined,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }
}

export const organizationService = new OrganizationService();

/** Used by migration/backfill — attach user to org with role derived from legacy UserRole */
export async function ensureMembershipFromLegacyUser(
  organizationId: string,
  userId: string,
  legacyRole: UserRole
) {
  await seedRolesAndPermissions();
  const roleKey = mapLegacyRole(legacyRole);
  if (roleKey === ROLE_KEYS.PLATFORM_ADMIN) return;
  const role = await getRoleByKey(roleKey);
  await prisma.organizationUser.upsert({
    where: { organizationId_userId: { organizationId, userId } },
    create: {
      organizationId,
      userId,
      roleId: role.id,
      status: MembershipStatus.ACTIVE,
      isPrimaryAdmin: legacyRole === UserRole.ADMIN,
      joinedAt: new Date(),
    },
    update: {
      roleId: role.id,
      status: MembershipStatus.ACTIVE,
    },
  });
}

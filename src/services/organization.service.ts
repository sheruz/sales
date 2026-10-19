import prisma from "@/lib/db/prisma";
import {
  InvitationStatus,
  MembershipStatus,
  OrganizationStatus,
  SubscriptionStatus,
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
import { env } from "@/lib/config/env";
import { sendEmailWithConfig } from "@/lib/email/send-mail";

export type AccessOption =
  | { type: "none" }
  | { type: "trial"; planCode: string; trialDays?: number }
  | { type: "manual"; planCode: string }
  | { type: "complimentary"; planCode: string; endDate?: Date | null };

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

  /**
   * Legacy create (self-signup when enabled): org ACTIVE + admin with password.
   * Subscription → NONE (never Free ACTIVE).
   */
  async createOrganization(input: {
    name: string;
    slug?: string;
    website?: string;
    legalName?: string;
    timezone?: string;
    defaultCurrency?: string;
    country?: string;
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
          country: input.country,
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

  /**
   * B1 Super Admin "New company": INVITED, no owner password, invite email 72h.
   */
  async createCompanyTenant(input: {
    name: string;
    slug?: string;
    country?: string;
    timezone?: string;
    defaultCurrency?: string;
    website?: string;
    legalName?: string;
    internalNotes?: string;
    owner: {
      email: string;
      firstName: string;
      lastName: string;
    };
    access: AccessOption;
    invitedById: string;
  }) {
    await this.ensureRbacSeeded();
    const slug = await ensureUniqueOrgSlug(input.slug ?? input.name);
    const companyAdminRole = await getRoleByKey(ROLE_KEYS.COMPANY_ADMIN);
    const ownerEmail = input.owner.email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: ownerEmail },
    });
    if (existingUser) {
      throw new ValidationError("Owner email already in use");
    }

    const org = await prisma.organization.create({
      data: {
        name: input.name.trim(),
        slug,
        country: input.country,
        website: input.website,
        legalName: input.legalName,
        timezone: input.timezone ?? "UTC",
        defaultCurrency: input.defaultCurrency ?? "USD",
        internalNotes: input.internalNotes,
        status: OrganizationStatus.INVITED,
        settings: {
          create: {
            timezone: input.timezone ?? "UTC",
            currency: input.defaultCurrency ?? "USD",
          },
        },
      },
    });

    // Subscription per access option
    if (input.access.type === "none") {
      await entitlementService.ensureSubscription(org.id);
    } else {
      const planCode =
        input.access.type === "complimentary"
          ? input.access.planCode || "COMPLIMENTARY"
          : input.access.planCode;
      const plan = await prisma.plan.findFirst({
        where: {
          OR: [{ code: planCode }, { name: planCode }],
          archivedAt: null,
        },
      });
      if (!plan?.currentVersionId) {
        throw new ValidationError(
          `Plan ${planCode} not seeded — run b1-apply`
        );
      }
      if (input.access.type === "trial") {
        await entitlementService.assignPlanVersion({
          organizationId: org.id,
          planVersionId: plan.currentVersionId,
          status: SubscriptionStatus.TRIALING,
          accessMode: "trial",
          trialDays: input.access.trialDays ?? env.BILLING_DEFAULT_TRIAL_DAYS,
          actorUserId: input.invitedById,
        });
      } else if (input.access.type === "manual") {
        await entitlementService.assignPlanVersion({
          organizationId: org.id,
          planVersionId: plan.currentVersionId,
          status: SubscriptionStatus.ACTIVE,
          accessMode: "manual",
          actorUserId: input.invitedById,
        });
      } else {
        const complimentary =
          (await prisma.plan.findFirst({
            where: { code: "COMPLIMENTARY", archivedAt: null },
          })) ?? plan;
        if (!complimentary.currentVersionId) {
          throw new ValidationError("COMPLIMENTARY plan not seeded");
        }
        await entitlementService.assignPlanVersion({
          organizationId: org.id,
          planVersionId: complimentary.currentVersionId,
          status: SubscriptionStatus.ACTIVE,
          accessMode: "complimentary",
          actorUserId: input.invitedById,
        });
      }
    }

    const invite = await this.createOwnerInvite({
      organizationId: org.id,
      email: ownerEmail,
      firstName: input.owner.firstName,
      lastName: input.owner.lastName,
      roleId: companyAdminRole.id,
      invitedById: input.invitedById,
    });

    await this.sendInviteEmail({
      to: ownerEmail,
      firstName: input.owner.firstName,
      organizationName: org.name,
      token: invite.token,
      expiresAt: invite.expiresAt,
    });

    await this.writePlatformAudit({
      actorUserId: input.invitedById,
      action: "tenant.create",
      targetType: "organization",
      targetId: org.id,
      organizationId: org.id,
      after: {
        name: org.name,
        access: input.access,
        ownerEmail,
      },
    });

    return { org, inviteToken: invite.token, inviteExpiresAt: invite.expiresAt };
  }

  private async createOwnerInvite(input: {
    organizationId: string;
    email: string;
    firstName: string;
    lastName: string;
    roleId: string;
    invitedById: string;
  }) {
    const token = generateInviteToken();
    const tokenHash = hashInviteToken(token);
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    // Store intended name on a pending user stub? Spec: user created without password.
    // Create user with random unusable hash; acceptInvitation will set password.
    const placeholderHash = await hashPassword(
      `invite-pending-${token.slice(0, 16)}-${Date.now()}`
    );
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash: placeholderHash,
        firstName: input.firstName,
        lastName: input.lastName,
        role: UserRole.ADMIN,
        isActive: false,
      },
    });

    await prisma.organizationUser.create({
      data: {
        organizationId: input.organizationId,
        userId: user.id,
        roleId: input.roleId,
        status: MembershipStatus.INVITED,
        isPrimaryAdmin: true,
        invitedAt: new Date(),
      },
    });

    await prisma.organizationInvitation.create({
      data: {
        organizationId: input.organizationId,
        email: input.email,
        roleId: input.roleId,
        invitedById: input.invitedById,
        tokenHash,
        expiresAt,
        status: InvitationStatus.PENDING,
      },
    });

    return { token, expiresAt, userId: user.id };
  }

  async sendInviteEmail(input: {
    to: string;
    firstName: string;
    organizationName: string;
    token: string;
    expiresAt: Date;
  }) {
    const link = `${env.APP_URL}/invite?token=${input.token}`;
    const text = `Hi ${input.firstName},

You've been invited to ${input.organizationName} on Delvix Revenue OS.

Set your password (link expires in 72 hours):
${link}

If you didn't expect this, ignore this email.`;

    if (
      !env.SMTP_HOST ||
      !env.SMTP_USER ||
      !env.SMTP_PASSWORD ||
      !env.SMTP_FROM_EMAIL
    ) {
      logger.warn("Invite email skipped — platform SMTP not configured", {
        to: input.to,
        link,
      });
      return { sent: false, link };
    }

    await sendEmailWithConfig(
      {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        user: env.SMTP_USER,
        password: env.SMTP_PASSWORD,
        fromName: env.SMTP_FROM_NAME,
        fromEmail: env.SMTP_FROM_EMAIL,
      },
      {
        to: input.to,
        subject: `You're invited to ${input.organizationName}`,
        text,
        html: text.replace(/\n/g, "<br>"),
      }
    );
    return { sent: true, link };
  }

  async resendInvite(organizationId: string, actorUserId: string) {
    const pending = await prisma.organizationInvitation.findFirst({
      where: {
        organizationId,
        status: InvitationStatus.PENDING,
      },
      orderBy: { createdAt: "desc" },
      include: { organization: true },
    });
    if (!pending) throw new NotFoundError("No pending invite");

    await prisma.organizationInvitation.update({
      where: { id: pending.id },
      data: { status: InvitationStatus.REVOKED },
    });

    const token = generateInviteToken();
    const tokenHash = hashInviteToken(token);
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    await prisma.organizationInvitation.create({
      data: {
        organizationId,
        email: pending.email,
        roleId: pending.roleId,
        invitedById: actorUserId,
        tokenHash,
        expiresAt,
        status: InvitationStatus.PENDING,
      },
    });

    const member = await prisma.organizationUser.findFirst({
      where: { organizationId, isPrimaryAdmin: true },
      include: { user: true },
    });

    const result = await this.sendInviteEmail({
      to: pending.email,
      firstName: member?.user.firstName ?? "there",
      organizationName: pending.organization.name,
      token,
      expiresAt,
    });

    await this.writePlatformAudit({
      actorUserId,
      action: "tenant.invite.resend",
      targetType: "organization",
      targetId: organizationId,
      organizationId,
      after: { email: pending.email },
    });

    return { token, expiresAt, link: result.link, sent: result.sent };
  }

  async cancelInvite(organizationId: string, actorUserId: string) {
    const pending = await prisma.organizationInvitation.findMany({
      where: { organizationId, status: InvitationStatus.PENDING },
    });
    if (!pending.length) throw new NotFoundError("No pending invite");
    await prisma.organizationInvitation.updateMany({
      where: { organizationId, status: InvitationStatus.PENDING },
      data: { status: InvitationStatus.REVOKED },
    });
    await this.writePlatformAudit({
      actorUserId,
      action: "tenant.invite.cancel",
      targetType: "organization",
      targetId: organizationId,
      organizationId,
    });
    return { canceled: pending.length };
  }

  async changeOwnerInviteEmail(
    organizationId: string,
    newEmail: string,
    actorUserId: string
  ) {
    const email = newEmail.toLowerCase().trim();
    const taken = await prisma.user.findUnique({ where: { email } });
    if (taken) throw new ValidationError("Email already in use");

    const primary = await prisma.organizationUser.findFirst({
      where: { organizationId, isPrimaryAdmin: true },
      include: { user: true },
    });
    if (!primary) throw new NotFoundError("Owner membership not found");

    const before = primary.user.email;
    await prisma.user.update({
      where: { id: primary.userId },
      data: { email },
    });
    await prisma.organizationInvitation.updateMany({
      where: { organizationId, status: InvitationStatus.PENDING },
      data: { email },
    });

    const resent = await this.resendInvite(organizationId, actorUserId);
    await this.writePlatformAudit({
      actorUserId,
      action: "tenant.invite.change_email",
      targetType: "organization",
      targetId: organizationId,
      organizationId,
      before: { email: before },
      after: { email },
    });
    return resent;
  }

  async writePlatformAudit(input: {
    actorUserId?: string | null;
    action: string;
    targetType: string;
    targetId?: string;
    organizationId?: string;
    before?: unknown;
    after?: unknown;
    reason?: string;
  }) {
    try {
      await prisma.platformAuditLog.create({
        data: {
          actorUserId: input.actorUserId ?? null,
          action: input.action,
          targetType: input.targetType,
          targetId: input.targetId,
          organizationId: input.organizationId,
          before: input.before as object | undefined,
          after: input.after as object | undefined,
          reason: input.reason,
        },
      });
    } catch (err) {
      logger.warn("platformAuditLog write failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
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
            isActive: true,
          },
        });
      } else {
        // B1 owner invite: user may exist inactive with placeholder password
        if (existing.deletedAt) {
          throw new ValidationError("Account is deactivated");
        }
        await tx.user.update({
          where: { id: existing.id },
          data: {
            passwordHash,
            firstName: input.firstName,
            lastName: input.lastName,
            isActive: true,
          },
        });
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
          isPrimaryAdmin: invite.role.key === ROLE_KEYS.COMPANY_ADMIN,
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

      // Owner set password → org INVITED → ACTIVE
      if (invite.organization.status === OrganizationStatus.INVITED) {
        await tx.organization.update({
          where: { id: invite.organizationId },
          data: { status: OrganizationStatus.ACTIVE },
        });
      }

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

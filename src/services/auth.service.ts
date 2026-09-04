import prisma from "@/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  deleteSession,
  getSessionUser,
} from "@/lib/auth/session";
import { UnauthorizedError, ValidationError } from "@/lib/api/response";
import { logger } from "@/lib/logger";
import { canAssignRole, canManageTargetUser } from "@/lib/auth/role-policy";
import { UserRole } from "@prisma/client";
import type { AuthUser } from "@/types/auth";
import type { CreateUserInput, UpdateUserInput } from "@/lib/auth/schemas";
import { ensureMembershipFromLegacyUser } from "@/services/organization.service";
import {
  generateInviteToken,
  hashInviteToken,
} from "@/lib/tenant/rbac";
import {
  assertNotLockedOut,
  clearLoginFailures,
  recordLoginFailure,
} from "@/lib/security/brute-force";
import { writeAuditLog } from "@/lib/security/audit";
import { env } from "@/lib/config/env";
import { sendEmailWithConfig } from "@/lib/email/send-mail";

interface SessionMeta {
  ipAddress?: string;
  userAgent?: string;
}

export class AuthService {
  async login(
    email: string,
    password: string,
    meta?: SessionMeta
  ): Promise<{ user: AuthUser; token: string }> {
    const normalized = email.toLowerCase().trim();
    const ip = meta?.ipAddress || "unknown";
    assertNotLockedOut(normalized, ip);

    const user = await prisma.user.findUnique({
      where: { email: normalized },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatarUrl: true,
        passwordHash: true,
        isActive: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt) {
      recordLoginFailure(normalized, ip);
      throw new UnauthorizedError("Invalid email or password");
    }

    if (!user.isActive) {
      recordLoginFailure(normalized, ip);
      throw new UnauthorizedError("Account is deactivated");
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      recordLoginFailure(normalized, ip);
      await writeAuditLog({
        userId: user.id,
        action: "auth.login_failed",
        entityType: "user",
        entityId: user.id,
        ipAddress: ip,
        userAgent: meta?.userAgent,
      });
      throw new UnauthorizedError("Invalid email or password");
    }

    clearLoginFailures(normalized, ip);

    const primaryMembership = await prisma.organizationUser.findFirst({
      where: { userId: user.id, status: "ACTIVE" },
      orderBy: [{ isPrimaryAdmin: "desc" }, { createdAt: "asc" }],
    });

    const token = await createSession(user.id, {
      ...meta,
      organizationId:
        user.role === UserRole.SUPER_ADMIN
          ? null
          : primaryMembership?.organizationId ?? null,
    });

    logger.info("User logged in", { userId: user.id, email: user.email });
    await writeAuditLog({
      organizationId: primaryMembership?.organizationId,
      userId: user.id,
      action: "auth.login",
      entityType: "user",
      entityId: user.id,
      ipAddress: ip,
      userAgent: meta?.userAgent,
    });

    const authUser = await getSessionUser(token);
    if (!authUser) {
      throw new UnauthorizedError("Failed to establish session");
    }

    return { user: authUser, token };
  }

  async logout(token: string): Promise<void> {
    await deleteSession(token);
  }

  async getCurrentUser(token: string): Promise<AuthUser | null> {
    return getSessionUser(token);
  }

  async listUsers() {
    return prisma.user.findMany({
      where: { deletedAt: null },
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
      orderBy: { createdAt: "desc" },
    });
  }

  async createUser(
    input: CreateUserInput,
    actorRole: UserRole,
    organizationId?: string | null
  ) {
    if (!canAssignRole(actorRole, input.role)) {
      throw new ValidationError("You cannot assign this role");
    }

    const existing = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new ValidationError("Email already in use");
    }

    const passwordHash = await hashPassword(input.password);

    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase().trim(),
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (organizationId && input.role !== UserRole.SUPER_ADMIN) {
      await ensureMembershipFromLegacyUser(
        organizationId,
        user.id,
        input.role
      );
    }

    logger.info("User created", {
      userId: user.id,
      email: user.email,
      organizationId: organizationId ?? undefined,
    });
    return user;
  }

  async updateUser(userId: string, input: UpdateUserInput, actorRole: UserRole) {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new ValidationError("User not found");
    }

    if (!canManageTargetUser(actorRole, user.role)) {
      throw new ValidationError("You cannot manage this user");
    }

    if (input.role && !canAssignRole(actorRole, input.role)) {
      throw new ValidationError("You cannot assign this role");
    }

    return prisma.user.update({
      where: { id: userId },
      data: input,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  async updateProfile(userId: string, input: { firstName: string; lastName: string; email: string }) {
    const email = input.email.toLowerCase().trim();
    const existing = await prisma.user.findFirst({
      where: { email, NOT: { id: userId } },
    });
    if (existing) throw new ValidationError("Email already in use");

    return prisma.user.update({
      where: { id: userId },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatarUrl: true,
      },
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) throw new ValidationError("User not found");

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedError("Current password is incorrect");

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    await prisma.session.deleteMany({ where: { userId } });
  }

  /**
   * Request password reset. Always returns success shape; token only returned
   * when user exists (caller may email it — never log the raw token).
   */
  async requestPasswordReset(email: string): Promise<{ token?: string }> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, isActive: true, deletedAt: true },
    });

    if (!user || !user.isActive || user.deletedAt) {
      return {};
    }

    const token = generateInviteToken();
    const tokenHash = hashInviteToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    logger.info("Password reset requested", { userId: user.id });

    // Email reset link via platform SMTP when configured
    if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD && env.SMTP_FROM_EMAIL) {
      const resetUrl = `${env.APP_URL}/reset-password?token=${token}`;
      try {
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
            to: email.toLowerCase().trim(),
            subject: "Reset your password",
            text: `Reset your password: ${resetUrl}\n\nThis link expires in 1 hour. If you did not request this, ignore this email.`,
            html: `<p>Reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 1 hour.</p>`,
          }
        );
      } catch (err) {
        logger.error("Password reset email failed", {
          userId: user.id,
          error: err instanceof Error ? err.message : "send_failed",
        });
      }
    }

    return { token };
  }

  async resetPasswordWithToken(token: string, newPassword: string) {
    const tokenHash = hashInviteToken(token);
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new ValidationError("Invalid or expired reset token");
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      prisma.session.deleteMany({ where: { userId: record.userId } }),
    ]);

    logger.info("Password reset completed", { userId: record.userId });
  }

  /** Super Admin / company admin support: force-set password and invalidate sessions */
  async adminResetPassword(userId: string, newPassword: string, actorId: string) {
    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    await prisma.session.deleteMany({ where: { userId } });
    logger.info("Admin password reset", { userId, actorId });
  }

  async deactivateUser(userId: string, actorId: string, actorRole: UserRole) {
    if (userId === actorId) {
      throw new ValidationError("Cannot deactivate your own account");
    }

    const target = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!target) {
      throw new ValidationError("User not found");
    }

    if (!canManageTargetUser(actorRole, target.role)) {
      throw new ValidationError("You cannot deactivate this user");
    }

    if (target.role === UserRole.SUPER_ADMIN) {
      const superAdminCount = await prisma.user.count({
        where: { role: UserRole.SUPER_ADMIN, isActive: true, deletedAt: null },
      });
      if (superAdminCount <= 1) {
        throw new ValidationError("Cannot deactivate the last super admin");
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false, deletedAt: new Date() },
    });

    await prisma.session.deleteMany({ where: { userId } });
    logger.info("User deactivated", { userId, actorId });
  }
}

export const authService = new AuthService();

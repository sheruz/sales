import prisma from "@/lib/db/prisma";
import {
  EmailAccountStatus,
  EmailProvider,
  type EmailAccount,
} from "@prisma/client";
import { encrypt, decrypt } from "@/lib/crypto/encrypt";
import { NotFoundError, ValidationError } from "@/lib/api/response";
import { userIntegrationService } from "@/services/user-integration.service";

export class EmailAccountService {
  async list(organizationId: string, userId?: string) {
    return prisma.emailAccount.findMany({
      where: {
        organizationId,
        ...(userId ? { userId } : {}),
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  }

  async getById(organizationId: string, id: string) {
    const account = await prisma.emailAccount.findFirst({
      where: { id, organizationId },
    });
    if (!account) throw new NotFoundError("Email account not found");
    return account;
  }

  async getDefaultForUser(organizationId: string, userId: string) {
    const preferred = await prisma.emailAccount.findFirst({
      where: {
        organizationId,
        userId,
        status: EmailAccountStatus.ACTIVE,
        isDefault: true,
      },
    });
    if (preferred) return preferred;
    return prisma.emailAccount.findFirst({
      where: {
        organizationId,
        userId,
        status: EmailAccountStatus.ACTIVE,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async upsertSmtp(
    organizationId: string,
    userId: string,
    input: {
      email: string;
      displayName?: string;
      smtpHost: string;
      smtpPort: number;
      smtpSecure?: boolean;
      smtpUser: string;
      smtpPassword: string;
      dailyLimit?: number;
    }
  ) {
    const email = input.email.trim().toLowerCase();
    const existing = await prisma.emailAccount.findFirst({
      where: { organizationId, email },
    });

    const data = {
      userId,
      provider: EmailProvider.SMTP,
      email,
      displayName: input.displayName ?? email,
      status: EmailAccountStatus.ACTIVE,
      smtpHost: input.smtpHost,
      smtpPort: input.smtpPort,
      smtpSecure: input.smtpSecure ?? false,
      smtpUser: input.smtpUser,
      encryptedSmtpPassword: encrypt(input.smtpPassword),
      dailyLimit: input.dailyLimit ?? 50,
      lastError: null,
    };

    if (existing) {
      return prisma.emailAccount.update({
        where: { id: existing.id },
        data,
      });
    }

    const count = await prisma.emailAccount.count({ where: { organizationId, userId } });
    return prisma.emailAccount.create({
      data: {
        organizationId,
        ...data,
        isDefault: count === 0,
      },
    });
  }

  async upsertOAuthAccount(input: {
    organizationId: string;
    userId: string;
    provider: "GMAIL" | "OUTLOOK";
    email: string;
    displayName?: string | null;
    accessToken: string;
    refreshToken?: string | null;
    expiresAt?: Date | null;
  }) {
    const email = input.email.trim().toLowerCase();
    const existing = await prisma.emailAccount.findFirst({
      where: { organizationId: input.organizationId, email },
    });

    const data = {
      userId: input.userId,
      provider:
        input.provider === "GMAIL" ? EmailProvider.GMAIL : EmailProvider.OUTLOOK,
      email,
      displayName: input.displayName ?? email,
      status: EmailAccountStatus.ACTIVE,
      encryptedAccessToken: encrypt(input.accessToken),
      encryptedRefreshToken: input.refreshToken
        ? encrypt(input.refreshToken)
        : undefined,
      tokenExpiresAt: input.expiresAt ?? null,
      lastError: null,
    };

    if (existing) {
      return prisma.emailAccount.update({
        where: { id: existing.id },
        data,
      });
    }

    const count = await prisma.emailAccount.count({
      where: { organizationId: input.organizationId, userId: input.userId },
    });
    return prisma.emailAccount.create({
      data: {
        organizationId: input.organizationId,
        ...data,
        isDefault: count === 0,
      },
    });
  }

  getAccessToken(account: EmailAccount): string | null {
    if (!account.encryptedAccessToken) return null;
    return decrypt(account.encryptedAccessToken);
  }

  getRefreshToken(account: EmailAccount): string | null {
    if (!account.encryptedRefreshToken) return null;
    return decrypt(account.encryptedRefreshToken);
  }

  getSmtpPassword(account: EmailAccount): string | null {
    if (!account.encryptedSmtpPassword) return null;
    return decrypt(account.encryptedSmtpPassword);
  }

  async markError(accountId: string, error: string) {
    await prisma.emailAccount.update({
      where: { id: accountId },
      data: {
        lastError: error.slice(0, 2000),
        status: EmailAccountStatus.ERROR,
      },
    });
  }

  async markSynced(accountId: string, cursor?: string | null) {
    await prisma.emailAccount.update({
      where: { id: accountId },
      data: {
        lastSyncAt: new Date(),
        syncCursor: cursor ?? undefined,
        lastError: null,
        status: EmailAccountStatus.ACTIVE,
      },
    });
  }

  async disconnect(organizationId: string, id: string) {
    const account = await this.getById(organizationId, id);
    await prisma.emailAccount.update({
      where: { id: account.id },
      data: {
        status: EmailAccountStatus.DISCONNECTED,
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
        encryptedSmtpPassword: null,
        lastError: null,
      },
    });
    if (account.provider === EmailProvider.SMTP) {
      await userIntegrationService.disconnect(
        organizationId,
        account.userId,
        "EMAIL_SMTP"
      );
    }
    return { disconnected: true };
  }

  async setDefault(organizationId: string, userId: string, id: string) {
    await this.getById(organizationId, id);
    await prisma.emailAccount.updateMany({
      where: { organizationId, userId },
      data: { isDefault: false },
    });
    return prisma.emailAccount.update({
      where: { id },
      data: { isDefault: true },
    });
  }

  sanitize(account: EmailAccount) {
    return {
      id: account.id,
      organizationId: account.organizationId,
      userId: account.userId,
      provider: account.provider,
      email: account.email,
      displayName: account.displayName,
      status: account.status,
      dailyLimit: account.dailyLimit,
      dailySent: account.dailySent,
      lastSyncAt: account.lastSyncAt,
      lastError: account.lastError,
      isDefault: account.isDefault,
      tokenExpiresAt: account.tokenExpiresAt,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      hasAccessToken: Boolean(account.encryptedAccessToken),
      hasSmtp: Boolean(account.smtpHost && account.encryptedSmtpPassword),
    };
  }
}

export const emailAccountService = new EmailAccountService();

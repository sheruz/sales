import prisma from "@/lib/db/prisma";
import { LinkedInConnectionType } from "@prisma/client";
import { encrypt, decrypt, isEncryptionConfigured } from "@/lib/crypto/encrypt";
import { buildSession, LinkedInVoyagerClient } from "@/lib/linkedin/voyager-client";
import {
  isLinkedInSessionEnabled,
  LINKEDIN_SESSION_DISABLED_MESSAGE,
} from "@/lib/linkedin/session-mode";
import { NotFoundError, ValidationError } from "@/lib/api/response";

export class LinkedInAccountService {
  async saveAccount(
    userId: string,
    data: { liAt: string; jsessionId: string; linkedInEmail?: string }
  ) {
    if (!isLinkedInSessionEnabled()) {
      throw new ValidationError(LINKEDIN_SESSION_DISABLED_MESSAGE);
    }

    if (!isEncryptionConfigured()) {
      throw new ValidationError(
        "ENCRYPTION_KEY must be set in .env to store LinkedIn credentials securely"
      );
    }

    const session = buildSession(data.liAt.trim(), data.jsessionId.trim());
    const client = new LinkedInVoyagerClient(session);
    const profile = await client.verifySession();

    const encryptedLiAt = encrypt(data.liAt.trim());
    const encryptedJsession = encrypt(data.jsessionId.trim());

    return prisma.linkedInAccount.upsert({
      where: { userId },
      create: {
        userId,
        connectionType: LinkedInConnectionType.SESSION,
        liAtCookie: encryptedLiAt,
        jsessionId: encryptedJsession,
        linkedInEmail: data.linkedInEmail,
        profileUrn: profile.urn,
        lastVerifiedAt: new Date(),
        isActive: true,
      },
      update: {
        connectionType: LinkedInConnectionType.SESSION,
        liAtCookie: encryptedLiAt,
        jsessionId: encryptedJsession,
        linkedInEmail: data.linkedInEmail,
        profileUrn: profile.urn,
        lastVerifiedAt: new Date(),
        isActive: true,
      },
    });
  }

  async getAccount(userId: string) {
    return prisma.linkedInAccount.findUnique({ where: { userId } });
  }

  async getClient(userId: string): Promise<LinkedInVoyagerClient> {
    if (!isLinkedInSessionEnabled()) {
      throw new NotFoundError(LINKEDIN_SESSION_DISABLED_MESSAGE);
    }

    const account = await prisma.linkedInAccount.findUnique({
      where: { userId, isActive: true },
    });

    if (account) {
      if (account.connectionType === LinkedInConnectionType.OAUTH) {
        throw new NotFoundError(
          "LinkedIn OAuth is connected for profile. Messaging requires LinkedIn API partner access — use email outreach."
        );
      }
      if (!account.liAtCookie) {
        throw new NotFoundError(
          "LinkedIn session not available. Connect LinkedIn in Settings → Integrations."
        );
      }
      const liAt = decrypt(account.liAtCookie);
      const jsessionId = account.jsessionId ? decrypt(account.jsessionId) : "";
      return new LinkedInVoyagerClient(buildSession(liAt, jsessionId));
    }

    // Env cron fallback (LINKEDIN_LI_AT / LINKEDIN_JSESSIONID) only when SESSION mode is enabled.
    // When disabled (S1 default), never fall back to platform env cookies.
    throw new NotFoundError(
      "LinkedIn account not connected. Use official OAuth in Settings → Integrations."
    );
  }

  async checkAndResetDailyLimits(userId: string) {
    const account = await this.getAccount(userId);
    if (!account) return null;

    const now = new Date();
    const lastReset = account.lastResetAt ?? account.createdAt;
    const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);

    if (hoursSinceReset >= 24) {
      return prisma.linkedInAccount.update({
        where: { userId },
        data: {
          dailySearchCount: 0,
          dailyMessageCount: 0,
          lastResetAt: now,
        },
      });
    }

    return account;
  }

  async canSearch(userId: string, limit: number): Promise<boolean> {
    if (!isLinkedInSessionEnabled()) return false;
    const account = await this.checkAndResetDailyLimits(userId);
    if (!account) return false;
    return account.dailySearchCount < limit;
  }

  async canMessage(userId: string, limit: number): Promise<boolean> {
    if (!isLinkedInSessionEnabled()) return false;
    const account = await this.checkAndResetDailyLimits(userId);
    if (!account) return false;
    return account.dailyMessageCount < limit;
  }

  async incrementSearch(userId: string, count = 1) {
    await prisma.linkedInAccount.update({
      where: { userId },
      data: { dailySearchCount: { increment: count } },
    });
  }

  async incrementMessage(userId: string, count = 1) {
    await prisma.linkedInAccount.update({
      where: { userId },
      data: { dailyMessageCount: { increment: count } },
    });
  }

  async disconnect(userId: string) {
    await prisma.linkedInAccount.update({
      where: { userId },
      data: { isActive: false },
    });
  }

  async getStatus(userId: string) {
    const account = await prisma.linkedInAccount.findUnique({
      where: { userId },
      select: {
        id: true,
        linkedInEmail: true,
        isActive: true,
        lastVerifiedAt: true,
        dailySearchCount: true,
        dailyMessageCount: true,
        profileUrn: true,
        connectionType: true,
      },
    });

    return {
      sessionModeEnabled: isLinkedInSessionEnabled(),
      account: account
        ? {
            id: account.id,
            linkedInEmail: account.linkedInEmail,
            isActive: account.isActive,
            lastVerifiedAt: account.lastVerifiedAt,
            dailySearchCount: account.dailySearchCount,
            dailyMessageCount: account.dailyMessageCount,
            profileUrn: account.profileUrn,
            connectionType: account.connectionType,
            // Never expose cookie/token fields
          }
        : null,
    };
  }
}

export const linkedInAccountService = new LinkedInAccountService();

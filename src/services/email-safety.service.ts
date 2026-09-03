import prisma from "@/lib/db/prisma";
import {
  EmailAccountStatus,
  EmailProvider,
  OrganizationStatus,
  SuppressionReason,
  type EmailAccount,
} from "@prisma/client";
import { ValidationError } from "@/lib/api/response";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SafetyCheckResult =
  | { ok: true }
  | { ok: false; reason: string };

function extractDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

export class EmailSafetyService {
  async assertCanSend(input: {
    organizationId: string;
    account: EmailAccount;
    toEmail: string;
    idempotencyKey?: string | null;
    sequenceActive?: boolean;
    previouslyContactedProhibited?: boolean;
  }): Promise<SafetyCheckResult> {
    const org = await prisma.organization.findFirst({
      where: { id: input.organizationId, deletedAt: null },
    });
    if (!org || org.status !== OrganizationStatus.ACTIVE) {
      return { ok: false, reason: "Organization is not active" };
    }

    if (input.account.status !== EmailAccountStatus.ACTIVE) {
      return { ok: false, reason: "Email account is not active" };
    }

    const to = input.toEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(to)) {
      return { ok: false, reason: "Invalid recipient email" };
    }

    const suppressed = await this.isSuppressed(input.organizationId, to);
    if (suppressed) {
      return { ok: false, reason: `Recipient suppressed (${suppressed.reason})` };
    }

    if (input.sequenceActive === false) {
      return { ok: false, reason: "Sequence is not active" };
    }

    if (input.previouslyContactedProhibited) {
      const prior = await prisma.message.findFirst({
        where: {
          organizationId: input.organizationId,
          toEmail: to,
          direction: "OUTBOUND",
          status: { in: ["SENT", "DELIVERED", "OPENED", "CLICKED", "REPLIED"] },
        },
      });
      if (prior) {
        return { ok: false, reason: "Recipient previously contacted (prohibited)" };
      }
    }

    await this.resetDailyCounterIfNeeded(input.account);
    const account = await prisma.emailAccount.findUnique({
      where: { id: input.account.id },
    });
    if (!account) return { ok: false, reason: "Email account not found" };
    if (account.dailySent >= account.dailyLimit) {
      return { ok: false, reason: "Daily send limit reached" };
    }

    if (account.lastError && account.status === EmailAccountStatus.ERROR) {
      return { ok: false, reason: "Email provider unhealthy" };
    }

    if (!input.idempotencyKey) {
      return { ok: false, reason: "Idempotency key required" };
    }

    const existing = await prisma.message.findFirst({
      where: {
        organizationId: input.organizationId,
        idempotencyKey: input.idempotencyKey,
      },
    });
    if (existing) {
      return { ok: false, reason: "Duplicate idempotency key" };
    }

    return { ok: true };
  }

  async isSuppressed(organizationId: string, email: string) {
    const normalized = email.trim().toLowerCase();
    const domain = extractDomain(normalized);
    return prisma.emailSuppression.findFirst({
      where: {
        organizationId,
        OR: [
          { email: normalized },
          ...(domain ? [{ domain }] : []),
        ],
      },
    });
  }

  async suppress(input: {
    organizationId: string;
    email?: string | null;
    domain?: string | null;
    reason: SuppressionReason;
    source?: string;
  }) {
    if (!input.email && !input.domain) {
      throw new ValidationError("email or domain required");
    }
    return prisma.emailSuppression.create({
      data: {
        organizationId: input.organizationId,
        email: input.email?.trim().toLowerCase() ?? null,
        domain: input.domain?.trim().toLowerCase() ?? null,
        reason: input.reason,
        source: input.source,
      },
    });
  }

  async listSuppressions(organizationId: string) {
    return prisma.emailSuppression.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
  }

  async resetDailyCounterIfNeeded(account: EmailAccount) {
    const now = new Date();
    const resetAt = account.dailySentResetAt;
    const needsReset =
      !resetAt ||
      resetAt.toDateString() !== now.toDateString();
    if (!needsReset) return;
    await prisma.emailAccount.update({
      where: { id: account.id },
      data: { dailySent: 0, dailySentResetAt: now },
    });
  }

  async incrementDailySent(accountId: string) {
    await prisma.emailAccount.update({
      where: { id: accountId },
      data: { dailySent: { increment: 1 } },
    });
  }
}

export const emailSafetyService = new EmailSafetyService();

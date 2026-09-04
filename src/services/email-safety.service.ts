import prisma from "@/lib/db/prisma";
import {
  EmailAccountStatus,
  OrganizationStatus,
  SuppressionReason,
  type EmailAccount,
  type Prisma,
} from "@prisma/client";
import { ValidationError } from "@/lib/api/response";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Outbound statuses that consume an org/account daily send slot. */
export const ORG_DAILY_COUNT_STATUSES = [
  "SCHEDULED",
  "SENT",
  "DELIVERED",
  "OPENED",
  "CLICKED",
  "REPLIED",
] as const;

export type SafetyCheckResult =
  | { ok: true }
  | { ok: false; reason: string; code?: "ORG_DAILY_LIMIT" | "ACCOUNT_DAILY_LIMIT" | "DUPLICATE" | "OTHER" };

type TxClient = Prisma.TransactionClient | typeof prisma;

function extractDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

/** Start of current UTC day — matches OrganizationSettings daily window. */
export function startOfUtcDay(now = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

/** Next UTC midnight — used to defer sequence enrollments until the quota resets. */
export function nextUtcMidnight(now = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );
}

export class EmailSafetyService {
  async getOrgDailyEmailLimit(organizationId: string): Promise<number> {
    const settings = await prisma.organizationSettings.findUnique({
      where: { organizationId },
      select: { dailyEmailLimit: true },
    });
    return settings?.dailyEmailLimit ?? 50;
  }

  /**
   * Source of truth: outbound Message rows for the org since UTC midnight
   * in statuses that represent a reserved or completed send.
   * SCHEDULED counts so concurrent workers cannot oversubscribe.
   */
  async countOrgDailySends(
    organizationId: string,
    client: TxClient = prisma
  ): Promise<number> {
    return client.message.count({
      where: {
        organizationId,
        direction: "OUTBOUND",
        status: { in: [...ORG_DAILY_COUNT_STATUSES] },
        OR: [
          { sentAt: { gte: startOfUtcDay() } },
          {
            sentAt: null,
            createdAt: { gte: startOfUtcDay() },
          },
        ],
      },
    });
  }

  async getOrgDailyUsage(organizationId: string) {
    const [limit, sent] = await Promise.all([
      this.getOrgDailyEmailLimit(organizationId),
      this.countOrgDailySends(organizationId),
    ]);
    return { sent, limit, remaining: Math.max(0, limit - sent) };
  }

  /**
   * Concurrent-safe org daily limit gate.
   * Holds a transaction-scoped advisory lock on the organization id while counting.
   */
  async assertOrgDailyLimit(
    organizationId: string,
    client?: TxClient
  ): Promise<SafetyCheckResult> {
    const run = async (tx: TxClient) => {
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock(hashtext($1::text))`,
        organizationId
      );
      const settings = await tx.organizationSettings.findUnique({
        where: { organizationId },
        select: { dailyEmailLimit: true },
      });
      const limit = settings?.dailyEmailLimit ?? 50;
      const sent = await this.countOrgDailySends(organizationId, tx);
      if (sent >= limit) {
        return {
          ok: false as const,
          reason: "Organization daily email limit reached",
          code: "ORG_DAILY_LIMIT" as const,
        };
      }
      return { ok: true as const };
    };

    if (client) return run(client);
    return prisma.$transaction((tx) => run(tx));
  }

  async assertCanSend(input: {
    organizationId: string;
    account: EmailAccount;
    toEmail: string;
    idempotencyKey?: string | null;
    sequenceActive?: boolean;
    previouslyContactedProhibited?: boolean;
    /** When true, skip duplicate-key rejection (caller will resume existing message). */
    allowExistingIdempotencyKey?: boolean;
    /** Optional open transaction (already holds org advisory lock). */
    tx?: TxClient;
  }): Promise<SafetyCheckResult> {
    const org = await (input.tx ?? prisma).organization.findFirst({
      where: { id: input.organizationId, deletedAt: null },
    });
    if (!org || org.status !== OrganizationStatus.ACTIVE) {
      return { ok: false, reason: "Organization is not active", code: "OTHER" };
    }

    if (input.account.status !== EmailAccountStatus.ACTIVE) {
      return {
        ok: false,
        reason: "Email account is not active",
        code: "OTHER",
      };
    }

    const to = input.toEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(to)) {
      return { ok: false, reason: "Invalid recipient email", code: "OTHER" };
    }

    const suppressed = await this.isSuppressed(input.organizationId, to);
    if (suppressed) {
      return {
        ok: false,
        reason: `Recipient suppressed (${suppressed.reason})`,
        code: "OTHER",
      };
    }

    if (input.sequenceActive === false) {
      return {
        ok: false,
        reason: "Sequence is not active",
        code: "OTHER",
      };
    }

    if (input.previouslyContactedProhibited) {
      const prior = await (input.tx ?? prisma).message.findFirst({
        where: {
          organizationId: input.organizationId,
          toEmail: to,
          direction: "OUTBOUND",
          status: { in: ["SENT", "DELIVERED", "OPENED", "CLICKED", "REPLIED"] },
        },
      });
      if (prior) {
        return {
          ok: false,
          reason: "Recipient previously contacted (prohibited)",
          code: "OTHER",
        };
      }
    }

    await this.resetDailyCounterIfNeeded(input.account);
    const account = await (input.tx ?? prisma).emailAccount.findUnique({
      where: { id: input.account.id },
    });
    if (!account) {
      return { ok: false, reason: "Email account not found", code: "OTHER" };
    }
    if (account.dailySent >= account.dailyLimit) {
      return {
        ok: false,
        reason: "Daily send limit reached",
        code: "ACCOUNT_DAILY_LIMIT",
      };
    }

    if (account.lastError && account.status === EmailAccountStatus.ERROR) {
      return {
        ok: false,
        reason: "Email provider unhealthy",
        code: "OTHER",
      };
    }

    if (!input.idempotencyKey) {
      return {
        ok: false,
        reason: "Idempotency key required",
        code: "OTHER",
      };
    }

    const existing = await (input.tx ?? prisma).message.findFirst({
      where: {
        organizationId: input.organizationId,
        idempotencyKey: input.idempotencyKey,
      },
    });
    if (existing && !input.allowExistingIdempotencyKey) {
      return {
        ok: false,
        reason: "Duplicate idempotency key",
        code: "DUPLICATE",
      };
    }

    // Resume of an already-reserved SCHEDULED draft must not re-check capacity
    // (that row already consumes a slot in countOrgDailySends).
    const alreadyReserved =
      existing &&
      input.allowExistingIdempotencyKey &&
      (existing.status === "SCHEDULED" ||
        existing.status === "SENT" ||
        existing.status === "DELIVERED");

    if (!alreadyReserved) {
      const orgLimit = input.tx
        ? await this.assertOrgDailyLimit(input.organizationId, input.tx)
        : await this.assertOrgDailyLimit(input.organizationId);
      if (!orgLimit.ok) return orgLimit;
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
      !resetAt || resetAt.toDateString() !== now.toDateString();
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

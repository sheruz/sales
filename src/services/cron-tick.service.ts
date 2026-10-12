import prisma from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

const ADVISORY_LOCK_KEY = 884422110; // sales-cron-automation

export class CronTickService {
  /** Try Postgres advisory lock; returns false if another tick holds it. */
  async tryAcquireLock(): Promise<boolean> {
    const rows = await prisma.$queryRawUnsafe<Array<{ locked: boolean }>>(
      `SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY}) AS locked`
    );
    return Boolean(rows?.[0]?.locked);
  }

  async releaseLock(): Promise<void> {
    await prisma.$queryRawUnsafe(
      `SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})`
    );
  }

  async startTick(input?: {
    organizationId?: string | null;
    skipped?: boolean;
    skipReason?: string | null;
  }) {
    return prisma.cronTickLog.create({
      data: {
        id: randomUUID(),
        organizationId: input?.organizationId ?? null,
        skipped: input?.skipped ?? false,
        skipReason: input?.skipReason ?? null,
        ok: true,
        startedAt: new Date(),
      },
    });
  }

  async finishTick(
    id: string,
    data: {
      ok: boolean;
      jobs?: Record<string, unknown>;
      counts?: Record<string, unknown>;
      errors?: unknown;
    }
  ) {
    return prisma.cronTickLog.update({
      where: { id },
      data: {
        finishedAt: new Date(),
        ok: data.ok,
        jobs: (data.jobs ?? undefined) as Prisma.InputJsonValue | undefined,
        counts: (data.counts ?? undefined) as Prisma.InputJsonValue | undefined,
        errors: (data.errors ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async lastTick() {
    return prisma.cronTickLog.findFirst({
      where: { organizationId: null },
      orderBy: { startedAt: "desc" },
    });
  }

  /** True if last finished tick is older than 15 minutes (or missing). */
  isStale(last: { finishedAt: Date | null; startedAt: Date } | null): boolean {
    if (!last) return true;
    const t = last.finishedAt ?? last.startedAt;
    return Date.now() - t.getTime() > 15 * 60 * 1000;
  }
}

export const cronTickService = new CronTickService();

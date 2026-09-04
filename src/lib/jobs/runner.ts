import { JobStatus, type Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { logger } from "@/lib/logger";

export type JobRunnerOptions<T> = {
  jobType: string;
  jobId?: string;
  /**
   * Required for tenant-owned jobs. Omit only for platform/system jobs and set
   * `isPlatformScoped: true`.
   */
  organizationId?: string;
  /** Explicit global/system job (cron housekeeping, etc.). */
  isPlatformScoped?: boolean;
  idempotencyKey?: string;
  maxAttempts?: number;
  timeoutMs?: number;
  backoffMs?: number;
  metadata?: Record<string, unknown>;
  run: () => Promise<T>;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Job timed out after ${timeoutMs}ms`)),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function assertJobScope(opts: JobRunnerOptions<unknown>) {
  const platform = Boolean(opts.isPlatformScoped);
  if (!platform && !opts.organizationId) {
    throw new Error(
      "organizationId is required for tenant job logs (or set isPlatformScoped)"
    );
  }
  if (platform && opts.organizationId) {
    throw new Error("Platform-scoped jobs must not set organizationId");
  }
}

/**
 * Shared job runner: retries, exponential backoff, timeout, idempotency log, DLQ status.
 */
export async function runJobWithRetries<T>(
  opts: JobRunnerOptions<T>
): Promise<{ ok: true; result: T } | { ok: false; error: string; deadLetter: boolean }> {
  assertJobScope(opts);
  const maxAttempts = opts.maxAttempts ?? 3;
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const baseBackoff = opts.backoffMs ?? 1_000;
  const isPlatformScoped = Boolean(opts.isPlatformScoped);

  if (opts.idempotencyKey) {
    const priors = await prisma.jobLog.findMany({
      where: {
        jobType: opts.jobType,
        status: JobStatus.COMPLETED,
        ...(isPlatformScoped
          ? { isPlatformScoped: true, organizationId: null }
          : { organizationId: opts.organizationId!, isPlatformScoped: false }),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const prior = priors.find((p) => {
      const meta = p.metadata as { idempotencyKey?: string } | null;
      return meta?.idempotencyKey === opts.idempotencyKey;
    });
    if (prior) {
      return {
        ok: true,
        result: (prior.metadata as { result?: T })?.result as T,
      };
    }
  }

  const baseMeta = {
    idempotencyKey: opts.idempotencyKey,
    ...(opts.metadata || {}),
  };

  let lastError = "unknown";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await prisma.jobLog.create({
      data: {
        organizationId: opts.organizationId ?? null,
        isPlatformScoped,
        jobType: opts.jobType,
        jobId: opts.jobId,
        status: JobStatus.PROCESSING,
        message: `attempt ${attempt}/${maxAttempts}`,
        metadata: baseMeta as Prisma.InputJsonValue,
      },
    });

    try {
      const result = await withTimeout(opts.run(), timeoutMs);
      await prisma.jobLog.create({
        data: {
          organizationId: opts.organizationId ?? null,
          isPlatformScoped,
          jobType: opts.jobType,
          jobId: opts.jobId,
          status: JobStatus.COMPLETED,
          message: "ok",
          metadata: {
            ...baseMeta,
            attempt,
            result: result as unknown as Prisma.InputJsonValue,
          } as Prisma.InputJsonValue,
        },
      });
      return { ok: true, result };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "job_failed";
      logger.warn("Job attempt failed", {
        jobType: opts.jobType,
        attempt,
        error: lastError,
        organizationId: opts.organizationId,
      });
      await prisma.jobLog.create({
        data: {
          organizationId: opts.organizationId ?? null,
          isPlatformScoped,
          jobType: opts.jobType,
          jobId: opts.jobId,
          status: JobStatus.FAILED,
          message: lastError,
          metadata: {
            ...baseMeta,
            attempt,
          } as Prisma.InputJsonValue,
        },
      });
      if (attempt < maxAttempts) {
        await sleep(baseBackoff * 2 ** (attempt - 1));
      }
    }
  }

  await prisma.jobLog.create({
    data: {
      organizationId: opts.organizationId ?? null,
      isPlatformScoped,
      jobType: opts.jobType,
      jobId: opts.jobId,
      status: JobStatus.FAILED,
      message: `dead-letter: ${lastError}`,
      metadata: {
        ...baseMeta,
        deadLetter: true,
      } as Prisma.InputJsonValue,
    },
  });

  return { ok: false, error: lastError, deadLetter: true };
}

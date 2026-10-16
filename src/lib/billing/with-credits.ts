import { randomUUID } from "crypto";
import { ForbiddenError, ValidationError } from "@/lib/api/response";
import { creditLedgerService } from "@/services/credit-ledger.service";
import type { CreditActionType } from "@/lib/billing/credit-actions";
import { CreditKeyMode } from "@prisma/client";

export type CreditRunResult<T> =
  | { ok: true; result: T; credits: number; skippedOwner: boolean }
  | {
      ok: false;
      paused: true;
      reason: "out_of_credits";
      message: string;
    };

/**
 * Reserve → work → commit. On failure refund. On out-of-credits soft-pause.
 * If COMMIT races with TTL refund, re-reserves once then retries commit.
 */
export async function withCreditReservation<T>(input: {
  organizationId: string;
  actionType: CreditActionType | string;
  idempotencyKey?: string;
  referenceType?: string;
  referenceId?: string;
  actorUserId?: string;
  keyMode?: CreditKeyMode;
  credits?: number;
  fn: () => Promise<T>;
}): Promise<CreditRunResult<T>> {
  const reserveKey =
    input.idempotencyKey ??
    `${input.actionType}:${input.referenceType ?? "x"}:${input.referenceId ?? randomUUID()}:${randomUUID()}`;

  let reservedCredits = 0;
  let skippedOwner = false;

  try {
    const reserved = await creditLedgerService.reserve({
      organizationId: input.organizationId,
      actionType: input.actionType,
      idempotencyKey: reserveKey,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      actorUserId: input.actorUserId,
      keyMode: input.keyMode,
      credits: input.credits,
    });
    reservedCredits = reserved.credits;
    skippedOwner = reserved.skippedOwner;
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return {
        ok: false,
        paused: true,
        reason: "out_of_credits",
        message: err.message,
      };
    }
    throw err;
  }

  try {
    const result = await input.fn();
    await finalizeCommit(input.organizationId, reserveKey, input.actorUserId, {
      actionType: input.actionType,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      keyMode: input.keyMode,
      credits: reservedCredits,
    });
    void creditLedgerService.checkAndEmitWarnings(input.organizationId);
    return { ok: true, result, credits: reservedCredits, skippedOwner };
  } catch (err) {
    if (reservedCredits > 0 || !skippedOwner) {
      try {
        await creditLedgerService.refund({
          organizationId: input.organizationId,
          reserveIdempotencyKey: reserveKey,
          actorUserId: input.actorUserId,
          reason: "action_failed",
        });
      } catch {
        // already committed/refunded
      }
    }
    throw err;
  }
}

async function finalizeCommit(
  organizationId: string,
  reserveKey: string,
  actorUserId: string | undefined,
  reReserve: {
    actionType: string;
    referenceType?: string;
    referenceId?: string;
    keyMode?: CreditKeyMode;
    credits: number;
  }
) {
  try {
    await creditLedgerService.commit({
      organizationId,
      reserveIdempotencyKey: reserveKey,
      actorUserId,
    });
  } catch (err) {
    // Expiry race: TTL sweep refunded first — never free; re-reserve then commit.
    if (
      err instanceof ValidationError &&
      /already refunded/i.test(err.message)
    ) {
      const newKey = `${reserveKey}:rereserve:${randomUUID()}`;
      await creditLedgerService.reserve({
        organizationId,
        actionType: reReserve.actionType,
        idempotencyKey: newKey,
        referenceType: reReserve.referenceType,
        referenceId: reReserve.referenceId,
        actorUserId,
        keyMode: reReserve.keyMode,
        credits: reReserve.credits > 0 ? reReserve.credits : undefined,
        reason: "commit_after_ttl_refund",
      });
      await creditLedgerService.commit({
        organizationId,
        reserveIdempotencyKey: newKey,
        actorUserId,
      });
      return;
    }
    throw err;
  }
}

/** Soft-pause signal for cron ticks (do not hard-fail the org tick). */
export function isOutOfCreditsPause(
  r: CreditRunResult<unknown>
): r is Extract<CreditRunResult<unknown>, { ok: false }> {
  return r.ok === false && r.paused === true;
}

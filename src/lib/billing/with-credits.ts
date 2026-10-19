/**
 * Thin wrapper around S2.5 billing gateway (keeps existing import sites working).
 */
import { CreditKeyMode } from "@prisma/client";
import type { CreditActionType } from "@/lib/billing/credit-actions";
import {
  billingGateway,
  isOutOfCreditsPause,
  type CreditRunResult,
} from "@/services/billing-gateway.service";

export type { CreditRunResult };
export { isOutOfCreditsPause };

/**
 * Reserve → work → commit. On failure refund. On deny soft-pause.
 * Delegates to billingGateway.withAuthorized.
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
  purpose?: string;
  fn: () => Promise<T>;
}): Promise<CreditRunResult<T>> {
  return billingGateway.withAuthorized({
    organizationId: input.organizationId,
    action: input.actionType,
    idempotencyKey: input.idempotencyKey,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    actorUserId: input.actorUserId,
    keyMode: input.keyMode,
    purpose: input.purpose,
    fn: input.fn,
  });
}

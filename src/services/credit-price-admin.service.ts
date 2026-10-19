/**
 * B2: Super Admin credit price editor. Changes apply to new authorizations only.
 */

import prisma from "@/lib/db/prisma";
import { CreditKeyMode } from "@prisma/client";
import { ValidationError } from "@/lib/api/response";
import { organizationService } from "@/services/organization.service";
import { DEFAULT_CREDIT_PRICES } from "@/lib/billing/credit-actions";

export class CreditPriceAdminService {
  async list() {
    const rows = await prisma.creditPrice.findMany({
      orderBy: [{ actionType: "asc" }, { keyMode: "asc" }],
    });
    return { prices: rows, catalog: DEFAULT_CREDIT_PRICES };
  }

  async upsert(input: {
    actionType: string;
    keyMode: CreditKeyMode;
    credits: number;
    active?: boolean;
    reason: string;
    actorUserId: string;
  }) {
    if (!input.reason?.trim()) throw new ValidationError("reason is required");
    if (!Number.isFinite(input.credits) || input.credits < 0) {
      throw new ValidationError("credits must be >= 0");
    }

    const before = await prisma.creditPrice.findUnique({
      where: {
        actionType_keyMode: {
          actionType: input.actionType,
          keyMode: input.keyMode,
        },
      },
    });

    const row = await prisma.creditPrice.upsert({
      where: {
        actionType_keyMode: {
          actionType: input.actionType,
          keyMode: input.keyMode,
        },
      },
      create: {
        actionType: input.actionType,
        keyMode: input.keyMode,
        credits: input.credits,
        active: input.active ?? true,
      },
      update: {
        credits: input.credits,
        active: input.active ?? true,
      },
    });

    await organizationService.writePlatformAudit({
      actorUserId: input.actorUserId,
      action: "credit_price.upsert",
      targetType: "credit_price",
      targetId: row.id,
      before,
      after: row,
      reason: input.reason,
    });

    return row;
  }
}

export const creditPriceAdminService = new CreditPriceAdminService();

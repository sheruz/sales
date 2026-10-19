/**
 * B2: Top-up packs + Super Admin manual grant (PURCHASE ledger).
 */

import prisma from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/response";
import { organizationService } from "@/services/organization.service";
import { creditLedgerService } from "@/services/credit-ledger.service";
import { randomUUID } from "crypto";

export class TopUpPackService {
  async list(includeArchived = false) {
    return prisma.topUpPack.findMany({
      where: includeArchived ? undefined : { archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { credits: "asc" }],
    });
  }

  async create(input: {
    name: string;
    credits: number;
    price: number;
    currency?: string;
    sortOrder?: number;
    reason: string;
    actorUserId: string;
  }) {
    if (!input.reason?.trim()) throw new ValidationError("reason is required");
    if (input.credits <= 0) throw new ValidationError("credits must be > 0");
    const pack = await prisma.topUpPack.create({
      data: {
        name: input.name.trim(),
        credits: input.credits,
        price: new Prisma.Decimal(input.price),
        currency: input.currency ?? "USD",
        sortOrder: input.sortOrder ?? 0,
        active: true,
      },
    });
    await organizationService.writePlatformAudit({
      actorUserId: input.actorUserId,
      action: "top_up_pack.created",
      targetType: "top_up_pack",
      targetId: pack.id,
      after: pack,
      reason: input.reason,
    });
    return pack;
  }

  async update(input: {
    id: string;
    name?: string;
    credits?: number;
    price?: number;
    currency?: string;
    sortOrder?: number;
    active?: boolean;
    reason: string;
    actorUserId: string;
  }) {
    if (!input.reason?.trim()) throw new ValidationError("reason is required");
    const before = await prisma.topUpPack.findUnique({ where: { id: input.id } });
    if (!before) throw new NotFoundError("Pack not found");
    const pack = await prisma.topUpPack.update({
      where: { id: input.id },
      data: {
        ...(input.name != null ? { name: input.name.trim() } : {}),
        ...(input.credits != null ? { credits: input.credits } : {}),
        ...(input.price != null
          ? { price: new Prisma.Decimal(input.price) }
          : {}),
        ...(input.currency != null ? { currency: input.currency } : {}),
        ...(input.sortOrder != null ? { sortOrder: input.sortOrder } : {}),
        ...(input.active != null ? { active: input.active } : {}),
      },
    });
    await organizationService.writePlatformAudit({
      actorUserId: input.actorUserId,
      action: "top_up_pack.updated",
      targetType: "top_up_pack",
      targetId: pack.id,
      before,
      after: pack,
      reason: input.reason,
    });
    return pack;
  }

  async archive(input: { id: string; reason: string; actorUserId: string }) {
    if (!input.reason?.trim()) throw new ValidationError("reason is required");
    const before = await prisma.topUpPack.findUnique({ where: { id: input.id } });
    if (!before) throw new NotFoundError("Pack not found");
    const pack = await prisma.topUpPack.update({
      where: { id: input.id },
      data: { archivedAt: new Date(), active: false },
    });
    await organizationService.writePlatformAudit({
      actorUserId: input.actorUserId,
      action: "top_up_pack.archived",
      targetType: "top_up_pack",
      targetId: pack.id,
      before,
      after: pack,
      reason: input.reason,
    });
    return pack;
  }

  /**
   * Manual SA grant — ledger PURCHASE, idempotent via grantKey.
   */
  async grantPack(input: {
    organizationId: string;
    packId: string;
    reason: string;
    actorUserId: string;
    /** Client-supplied idempotency key; defaults to unique per call */
    idempotencyKey?: string;
  }) {
    if (!input.reason?.trim()) throw new ValidationError("reason is required");
    const pack = await prisma.topUpPack.findUnique({ where: { id: input.packId } });
    if (!pack || pack.archivedAt) throw new NotFoundError("Pack not found");

    const idempotencyKey =
      input.idempotencyKey?.trim() ||
      `topup_grant:${input.organizationId}:${input.packId}:${randomUUID()}`;

    const result = await creditLedgerService.grant({
      organizationId: input.organizationId,
      amount: pack.credits,
      type: "PURCHASE",
      idempotencyKey,
      reason: input.reason,
      actorUserId: input.actorUserId,
    });

    await organizationService.writePlatformAudit({
      actorUserId: input.actorUserId,
      action: "top_up_pack.granted",
      targetType: "top_up_pack",
      targetId: pack.id,
      organizationId: input.organizationId,
      after: {
        credits: pack.credits,
        balanceAfter: result.balanceAfter,
        alreadyExists: result.alreadyExists,
        idempotencyKey,
      },
      reason: input.reason,
    });

    return { ...result, pack, idempotencyKey };
  }
}

export const topUpPackService = new TopUpPackService();

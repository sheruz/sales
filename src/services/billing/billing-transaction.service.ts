/**
 * B3.2: Persist money movements for SA Transactions / Revenue.
 */

import prisma from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

export type RecordBillingTxnInput = {
  organizationId: string;
  provider: string;
  environment: string;
  kind: string;
  status: string;
  amount: number;
  currency?: string;
  taxAmount?: number | null;
  feeAmount?: number | null;
  netAmount?: number | null;
  externalId?: string | null;
  externalInvoiceId?: string | null;
  planVersionId?: string | null;
  topUpPackId?: string | null;
  description?: string | null;
  occurredAt: Date;
  metadata?: Record<string, unknown>;
};

export class BillingTransactionService {
  async record(input: RecordBillingTxnInput) {
    if (!input.organizationId) return null;
    const externalId = input.externalId || null;
    if (externalId) {
      const existing = await prisma.billingTransaction.findFirst({
        where: {
          provider: input.provider,
          environment: input.environment,
          externalId,
        },
      });
      if (existing) {
        return prisma.billingTransaction.update({
          where: { id: existing.id },
          data: {
            status: input.status,
            amount: new Prisma.Decimal(input.amount),
            currency: input.currency || undefined,
            taxAmount:
              input.taxAmount != null
                ? new Prisma.Decimal(input.taxAmount)
                : undefined,
            feeAmount:
              input.feeAmount != null
                ? new Prisma.Decimal(input.feeAmount)
                : undefined,
            netAmount:
              input.netAmount != null
                ? new Prisma.Decimal(input.netAmount)
                : undefined,
            metadata: (input.metadata || {}) as Prisma.InputJsonValue,
          },
        });
      }
    }

    return prisma.billingTransaction.create({
      data: {
        organizationId: input.organizationId,
        provider: input.provider,
        environment: input.environment,
        kind: input.kind,
        status: input.status,
        amount: new Prisma.Decimal(input.amount),
        currency: input.currency || "USD",
        taxAmount:
          input.taxAmount != null
            ? new Prisma.Decimal(input.taxAmount)
            : null,
        feeAmount:
          input.feeAmount != null
            ? new Prisma.Decimal(input.feeAmount)
            : null,
        netAmount:
          input.netAmount != null
            ? new Prisma.Decimal(input.netAmount)
            : null,
        externalId,
        externalInvoiceId: input.externalInvoiceId || null,
        planVersionId: input.planVersionId || null,
        topUpPackId: input.topUpPackId || null,
        description: input.description || null,
        occurredAt: input.occurredAt,
        metadata: (input.metadata || {}) as Prisma.InputJsonValue,
      },
    });
  }

  async list(filters: {
    environment?: string;
    organizationId?: string;
    provider?: string;
    status?: string;
    kind?: string;
    take?: number;
    skip?: number;
  }) {
    const where: Prisma.BillingTransactionWhereInput = {};
    if (filters.environment) where.environment = filters.environment;
    if (filters.organizationId) where.organizationId = filters.organizationId;
    if (filters.provider) where.provider = filters.provider;
    if (filters.status) where.status = filters.status;
    if (filters.kind) where.kind = filters.kind;
    const take = Math.min(filters.take ?? 100, 500);
    const skip = filters.skip ?? 0;
    const [rows, total] = await Promise.all([
      prisma.billingTransaction.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        take,
        skip,
        include: {
          organization: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.billingTransaction.count({ where }),
    ]);
    return { rows, total };
  }
}

export const billingTransactionService = new BillingTransactionService();

import { randomUUID } from "crypto";
import prisma from "@/lib/db/prisma";
import { AIUsageStatus, type Prisma } from "@prisma/client";

/** Rough USD estimates — never log API keys. */
export function estimateTokenCostUsd(params: {
  provider?: string;
  model?: string;
  promptTokens?: number;
  outputTokens?: number;
}): number | null {
  const prompt = params.promptTokens ?? 0;
  const output = params.outputTokens ?? 0;
  if (!prompt && !output) return null;

  const model = (params.model || "").toLowerCase();
  // defaults approximate public list prices (USD per 1M tokens)
  let inPerM = 0.15;
  let outPerM = 0.6;
  if (model.includes("gpt-4o") && !model.includes("mini")) {
    inPerM = 2.5;
    outPerM = 10;
  } else if (model.includes("claude") && model.includes("sonnet")) {
    inPerM = 3;
    outPerM = 15;
  } else if (model.includes("claude") && model.includes("haiku")) {
    inPerM = 0.8;
    outPerM = 4;
  }

  return Number((((prompt * inPerM) + (output * outPerM)) / 1_000_000).toFixed(6));
}

export async function logAIUsage(params: {
  organizationId?: string | null;
  userId?: string;
  feature: string;
  operation?: string;
  provider?: string;
  model?: string;
  promptTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  requestId?: string;
  status?: AIUsageStatus;
  metadata?: Record<string, unknown>;
}) {
  try {
    // Strip any accidental secret-like keys from metadata
    const safeMeta = sanitizeMetadata(params.metadata);
    const cost = estimateTokenCostUsd({
      provider: params.provider,
      model: params.model,
      promptTokens: params.promptTokens,
      outputTokens: params.outputTokens,
    });

    await prisma.aIUsageLog.create({
      data: {
        organizationId: params.organizationId ?? null,
        userId: params.userId,
        feature: params.feature,
        operation: params.operation ?? params.feature,
        provider: params.provider,
        model: params.model,
        promptTokens: params.promptTokens,
        outputTokens: params.outputTokens,
        totalTokens: params.totalTokens,
        cost,
        requestId: params.requestId ?? randomUUID(),
        status: params.status ?? AIUsageStatus.SUCCESS,
        metadata: safeMeta as Prisma.InputJsonValue | undefined,
      },
    });
  } catch {
    // Non-blocking
  }
}

function sanitizeMetadata(
  metadata?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const blocked = /key|secret|password|token|authorization|credential/i;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (blocked.test(k)) continue;
    if (typeof v === "string" && /sk-|sk-ant-|Bearer\s/i.test(v)) continue;
    out[k] = v;
  }
  return out;
}

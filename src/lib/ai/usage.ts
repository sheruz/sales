import prisma from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

export async function logAIUsage(params: {
  userId?: string;
  feature: string;
  model?: string;
  promptTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.aIUsageLog.create({
      data: {
        userId: params.userId,
        feature: params.feature,
        model: params.model,
        promptTokens: params.promptTokens,
        outputTokens: params.outputTokens,
        totalTokens: params.totalTokens,
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  } catch {
    // Non-blocking
  }
}

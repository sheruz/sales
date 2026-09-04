import { env } from "@/lib/config/env";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import { resolveAiRuntime } from "./resolve-config";
import { logAIUsage } from "./usage";
import type { AICompletionOptions, AICompletionResult, AIProvider } from "./types";
import { entitlementService } from "@/services/entitlement.service";
import { FEATURE_KEYS } from "@/lib/billing/features";
import { UsageMetric } from "@prisma/client";

const openaiProvider = new OpenAIProvider();
const anthropicProvider = new AnthropicProvider();

function getProvider(name: "openai" | "anthropic"): AIProvider {
  return name === "anthropic" ? anthropicProvider : openaiProvider;
}

/** @deprecated Use aiComplete with userId instead */
export function getAIProvider(): AIProvider {
  return env.AI_PROVIDER === "anthropic" ? anthropicProvider : openaiProvider;
}

export async function aiComplete(
  options: AICompletionOptions & {
    feature: string;
    userId?: string;
    organizationId?: string | null;
    operation?: string;
  }
): Promise<AICompletionResult> {
  if (options.organizationId) {
    await entitlementService.assertAndConsume(
      options.organizationId,
      FEATURE_KEYS.AI_CALLS
    );
  }

  const runtime = await resolveAiRuntime(options.userId, options.feature);
  const provider = getProvider(runtime.provider);
  const requestId = crypto.randomUUID();

  try {
    const result = await provider.complete({
      ...options,
      apiKey: runtime.apiKey,
      model: runtime.model,
    });

    if (options.organizationId && (result.totalTokens ?? 0) > 0) {
      await entitlementService.incrementUsage(
        options.organizationId,
        UsageMetric.TOKENS,
        result.totalTokens ?? 0
      );
    }

    await logAIUsage({
      organizationId: options.organizationId,
      userId: options.userId,
      feature: options.feature,
      operation: options.operation ?? options.feature,
      provider: runtime.provider,
      model: result.model,
      promptTokens: result.promptTokens,
      outputTokens: result.outputTokens,
      totalTokens: result.totalTokens,
      requestId,
      status: "SUCCESS",
      metadata: { source: runtime.source },
    });

    return result;
  } catch (error) {
    await logAIUsage({
      organizationId: options.organizationId,
      userId: options.userId,
      feature: options.feature,
      operation: options.operation ?? options.feature,
      provider: runtime.provider,
      model: runtime.model,
      requestId,
      status: "ERROR",
      metadata: {
        source: runtime.source,
        error: error instanceof Error ? error.message : "unknown",
      },
    });
    throw error;
  }
}

export function parseAIJson<T>(content: string): T {
  const cleaned = content.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(cleaned) as T;
}

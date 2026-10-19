import { env } from "@/lib/config/env";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import { resolveAiRuntime } from "./resolve-config";
import { logAIUsage } from "./usage";
import type { AICompletionOptions, AICompletionResult, AIProvider } from "./types";
import { entitlementService } from "@/services/entitlement.service";
import { UsageMetric } from "@prisma/client";
import { billingGateway } from "@/services/billing-gateway.service";
import { resolveAiBillingAction } from "@/lib/billing/actions";
import { ForbiddenError } from "@/lib/api/response";

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
    /** Rare platform/system AI only — never for tenant features. */
    isPlatformScoped?: boolean;
    operation?: string;
    /**
     * Purpose tag for metering. Inbound purposes
     * (reply classification, bounce/unsub) are metered for stats but always exempt.
     */
    purpose?: string;
    /**
     * Parent already authorized (e.g. ai_reply_draft credit wrap).
     * Still required: every other aiComplete must go through the gateway.
     */
    billingAuthorized?: boolean;
  }
): Promise<AICompletionResult> {
  const isPlatformScoped = Boolean(options.isPlatformScoped);
  if (!isPlatformScoped && !options.organizationId) {
    throw new Error(
      "organizationId is required for tenant AI calls (or set isPlatformScoped)"
    );
  }

  const purpose = options.purpose ?? options.feature;
  let reservationId: string | null = null;

  if (options.organizationId && !options.billingAuthorized && !isPlatformScoped) {
    const action = resolveAiBillingAction(purpose);
    const auth = await billingGateway.authorize({
      organizationId: options.organizationId,
      action,
      purpose,
      actorUserId: options.userId,
      referenceType: "ai_complete",
      referenceId: options.operation ?? options.feature,
    });
    if (!auth.allowed) {
      throw new ForbiddenError(auth.message);
    }
    reservationId = auth.reservationId;
  }

  const runtime = await resolveAiRuntime(options.userId, options.feature);
  const provider = getProvider(runtime.provider);
  const requestId = crypto.randomUUID();

  try {
    const result = await provider.complete({
      ...options,
      apiKey: runtime.apiKey,
      model: options.model?.trim() || runtime.model,
    });

    if (reservationId && options.organizationId) {
      await billingGateway.commit({
        organizationId: options.organizationId,
        reservationId,
        actorUserId: options.userId,
      });
    }

    if (options.organizationId && (result.totalTokens ?? 0) > 0) {
      await entitlementService.incrementUsage(
        options.organizationId,
        UsageMetric.TOKENS,
        result.totalTokens ?? 0
      );
    }

    await logAIUsage({
      organizationId: options.organizationId,
      isPlatformScoped,
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
    if (reservationId && options.organizationId) {
      try {
        await billingGateway.refund({
          organizationId: options.organizationId,
          reservationId,
          actorUserId: options.userId,
          reason: "ai_complete_failed",
        });
      } catch {
        // ignore
      }
    }
    await logAIUsage({
      organizationId: options.organizationId,
      isPlatformScoped,
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

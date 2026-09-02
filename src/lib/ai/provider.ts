import { env } from "@/lib/config/env";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import { resolveAiRuntime } from "./resolve-config";
import { logAIUsage } from "./usage";
import type { AICompletionOptions, AICompletionResult, AIProvider } from "./types";

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
  options: AICompletionOptions & { feature: string; userId?: string }
): Promise<AICompletionResult> {
  const runtime = await resolveAiRuntime(options.userId, options.feature);
  const provider = getProvider(runtime.provider);

  const result = await provider.complete({
    ...options,
    apiKey: runtime.apiKey,
    model: runtime.model,
  });

  await logAIUsage({
    userId: options.userId,
    feature: options.feature,
    model: result.model,
    promptTokens: result.promptTokens,
    outputTokens: result.outputTokens,
    totalTokens: result.totalTokens,
    metadata: { source: runtime.source, provider: runtime.provider },
  });

  return result;
}

export function parseAIJson<T>(content: string): T {
  const cleaned = content.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(cleaned) as T;
}

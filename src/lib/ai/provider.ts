import { env } from "@/lib/config/env";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import { logAIUsage } from "./usage";
import type { AICompletionOptions, AICompletionResult, AIProvider } from "./types";

let cachedProvider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (cachedProvider) return cachedProvider;

  cachedProvider =
    env.AI_PROVIDER === "anthropic" ? new AnthropicProvider() : new OpenAIProvider();

  return cachedProvider;
}

export async function aiComplete(
  options: AICompletionOptions & { feature: string; userId?: string }
): Promise<AICompletionResult> {
  const provider = getAIProvider();
  const result = await provider.complete(options);

  await logAIUsage({
    userId: options.userId,
    feature: options.feature,
    model: result.model,
    promptTokens: result.promptTokens,
    outputTokens: result.outputTokens,
    totalTokens: result.totalTokens,
  });

  return result;
}

export function parseAIJson<T>(content: string): T {
  const cleaned = content.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(cleaned) as T;
}

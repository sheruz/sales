import { env } from "@/lib/config/env";
import type { AICompletionOptions, AICompletionResult, AIProvider } from "./types";

export class AnthropicProvider implements AIProvider {
  name = "anthropic";

  async complete(options: AICompletionOptions): Promise<AICompletionResult> {
    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

    const model = env.ANTHROPIC_MODEL;
    const systemMessage = options.messages.find((m) => m.role === "system");
    const otherMessages = options.messages.filter((m) => m.role !== "system");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens ?? 4096,
        system: systemMessage?.content,
        messages: otherMessages.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
        temperature: options.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${err}`);
    }

    const data = await response.json();
    const content =
      data.content?.find((c: { type: string }) => c.type === "text")?.text ?? "";
    const usage = data.usage;

    return {
      content,
      model,
      promptTokens: usage?.input_tokens,
      outputTokens: usage?.output_tokens,
      totalTokens: (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0),
    };
  }
}

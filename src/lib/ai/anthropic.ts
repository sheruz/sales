import { env } from "@/lib/config/env";
import type { AICompletionOptions, AICompletionResult, AIProvider } from "./types";

const FALLBACK_MODELS = [
  "claude-sonnet-4-6",
  "claude-sonnet-4-5-20250929",
  "claude-haiku-4-5-20251001",
];

export class AnthropicProvider implements AIProvider {
  name = "anthropic";

  async complete(options: AICompletionOptions): Promise<AICompletionResult> {
    const apiKey = options.apiKey ?? env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("Anthropic API key is not configured. Add your key in Settings → Integrations.");

    const configured = options.model ?? env.ANTHROPIC_MODEL;
    const modelsToTry = [
      configured,
      ...FALLBACK_MODELS.filter((m) => m !== configured),
    ];

    let lastError = "Unknown error";

    for (const model of modelsToTry) {
      try {
        return await this.completeWithModel(model, options, apiKey);
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (!lastError.includes("not_found_error") && !lastError.includes("404")) {
          throw err;
        }
      }
    }

    throw new Error(
      `No valid Anthropic model found. Tried: ${modelsToTry.join(", ")}. Last error: ${lastError}`
    );
  }

  private async completeWithModel(
    model: string,
    options: AICompletionOptions,
    apiKey: string
  ): Promise<AICompletionResult> {
    const systemMessage = options.messages.find((m) => m.role === "system");
    const otherMessages = options.messages.filter((m) => m.role !== "system");

    const body: Record<string, unknown> = {
      model,
      max_tokens: options.maxTokens ?? 4096,
      system: systemMessage?.content,
      messages: otherMessages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
      temperature: options.temperature ?? 0.7,
    };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
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

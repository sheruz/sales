export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AICompletionOptions {
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  /** Override for per-user BYOK */
  apiKey?: string;
  model?: string;
}

export interface AICompletionResult {
  content: string;
  model: string;
  promptTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface AIProvider {
  name: string;
  complete(options: AICompletionOptions): Promise<AICompletionResult>;
}

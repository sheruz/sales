/**
 * Thin Paddle Billing API client. Keys never logged.
 */

import { env } from "@/lib/config/env";
import type { ProviderEnvironment } from "@/services/billing/provider-types";

export function paddleEnvironment(): ProviderEnvironment {
  return env.PADDLE_ENV === "production" ? "production" : "sandbox";
}

export function paddleApiBase(): string {
  return paddleEnvironment() === "production"
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";
}

export function isPaddleConfigured(): boolean {
  return Boolean(env.PADDLE_API_KEY && env.PADDLE_CLIENT_TOKEN && env.PADDLE_WEBHOOK_SECRET);
}

export async function paddleFetch<T = unknown>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const key = env.PADDLE_API_KEY;
  if (!key) throw new Error("PADDLE_API_KEY is not configured");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${paddleApiBase()}${path}`, {
    ...init,
    headers,
    body:
      init?.json !== undefined
        ? JSON.stringify(init.json)
        : init?.body,
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg =
      typeof data === "object" && data && "error" in data
        ? JSON.stringify((data as { error: unknown }).error)
        : text.slice(0, 300);
    throw new Error(`Paddle API ${res.status}: ${msg}`);
  }

  return data as T;
}

/** Paddle-Signature: ts=...;h1=... */
export async function verifyPaddleSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(";").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim(), v?.trim()];
    })
  );
  const ts = parts.ts;
  const h1 = parts.h1;
  if (!ts || !h1) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${ts}:${rawBody}`)
  );
  const hex = Buffer.from(signed).toString("hex");
  if (hex.length !== h1.length) return false;
  let ok = 0;
  for (let i = 0; i < hex.length; i++) {
    ok |= hex.charCodeAt(i) ^ h1.charCodeAt(i);
  }
  return ok === 0;
}

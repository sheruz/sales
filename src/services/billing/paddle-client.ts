/**
 * Thin Paddle Billing API client. Credentials from PaymentProviderConfig (never logged).
 */

import { paymentConfigService } from "@/services/billing/payment-config.service";
import type { ProviderEnvironment } from "@/services/billing/provider-types";

export async function getPaddleRuntime(): Promise<{
  environment: ProviderEnvironment;
  apiKey: string;
  clientToken: string;
  webhookSecret: string;
  apiBase: string;
}> {
  const cfg = await paymentConfigService.getProviderCredentials("PADDLE");
  if (!cfg?.credentials.apiKey) {
    throw new Error("Paddle is not configured (missing API key in Super Admin → Payments)");
  }
  const environment = cfg.environment;
  return {
    environment,
    apiKey: cfg.credentials.apiKey,
    clientToken: cfg.credentials.clientToken || "",
    webhookSecret: cfg.credentials.webhookSecret || "",
    apiBase:
      environment === "production"
        ? "https://api.paddle.com"
        : "https://sandbox-api.paddle.com",
  };
}

export async function paddleEnvironment(): Promise<ProviderEnvironment> {
  try {
    const rt = await getPaddleRuntime();
    return rt.environment;
  } catch {
    return "sandbox";
  }
}

export async function isPaddleConfigured(): Promise<boolean> {
  const row = await paymentConfigService.getProviderConfig("PADDLE");
  if (!row?.enabled) return false;
  const creds = paymentConfigService.getCredentials(row);
  return Boolean(creds?.apiKey && creds?.clientToken && creds?.webhookSecret);
}

export async function paddleFetch<T = unknown>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const rt = await getPaddleRuntime();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${rt.apiKey}`,
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${rt.apiBase}${path}`, {
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

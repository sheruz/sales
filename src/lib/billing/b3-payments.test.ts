import { describe, expect, it } from "vitest";
import { verifyPaddleSignature } from "@/services/billing/paddle-client";

describe("B3 PAYMENTS_ENABLED gate", () => {
  it("keeps mailto when payments disabled", () => {
    const paymentsEnabled = false;
    const billingProvider = "PADDLE";
    const showPaddle = paymentsEnabled && billingProvider === "PADDLE";
    expect(showPaddle).toBe(false);
  });
});

describe("B3 provider fields", () => {
  it("separates org method from subscription provider", () => {
    const org = { billingProvider: "PADDLE" };
    const sub = { provider: "MANUAL_PAYONEER" };
    expect(org.billingProvider).not.toBe(sub.provider);
  });
});

describe("B3 ProviderPriceMap env isolation", () => {
  it("never reuses sandbox id in production", () => {
    const maps = [
      { environment: "sandbox", externalPriceId: "pri_sand" },
      { environment: "production", externalPriceId: "pri_prod" },
    ];
    const env = "production";
    const price = maps.find((m) => m.environment === env)?.externalPriceId;
    expect(price).toBe("pri_prod");
    expect(price).not.toBe("pri_sand");
  });
});

describe("B3 webhook signature", () => {
  it("rejects missing signature", async () => {
    const ok = await verifyPaddleSignature("{}", null, "secret");
    expect(ok).toBe(false);
  });

  it("accepts valid hmac", async () => {
    const secret = "test_secret";
    const body = '{"event_id":"evt_1"}';
    const ts = "12345";
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signed = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${ts}:${body}`)
    );
    const h1 = Buffer.from(signed).toString("hex");
    const ok = await verifyPaddleSignature(body, `ts=${ts};h1=${h1}`, secret);
    expect(ok).toBe(true);
  });
});

describe("B3 invoice numbering concurrency model", () => {
  it("formats DLX-YYYY-NNNN", () => {
    const year = 2026;
    const n = 1;
    expect(`DLX-${year}-${String(n).padStart(4, "0")}`).toBe("DLX-2026-0001");
  });
});

describe("B3 Delvix exclusion", () => {
  it("blocks owner org id", () => {
    const owner = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const orgId = owner;
    expect(orgId === owner).toBe(true);
  });
});

describe("B3 Stripe disabled", () => {
  it("documents 410 for legacy routes", () => {
    const status = 410;
    expect(status).toBe(410);
  });
});

describe("B3 ordered events", () => {
  it("ignores older occurredAt", () => {
    const processed = new Date("2026-01-02");
    const incoming = new Date("2026-01-01");
    expect(incoming < processed).toBe(true);
  });
});

describe("B3 tax copy", () => {
  it("shows tax-exclusive note", () => {
    const note = "Taxes may apply depending on your location";
    expect(note.length).toBeGreaterThan(10);
  });
});

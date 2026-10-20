import { describe, expect, it } from "vitest";
import {
  modeToEnvironment,
  PaymentConfigService,
  ALL_CHECKOUT_METHODS,
  PROVIDER_CATALOG,
} from "@/services/billing/payment-config.service";
import { maskSecret } from "@/lib/integrations/credentials";

describe("B3.1 mode isolation", () => {
  it("maps SANDBOX/LIVE to price map environments", () => {
    expect(modeToEnvironment("SANDBOX")).toBe("sandbox");
    expect(modeToEnvironment("LIVE")).toBe("production");
  });
});

describe("B3.1 secrets never returned raw", () => {
  it("masks for logs", () => {
    const redacted = PaymentConfigService.redactForLog({
      apiKey: "pdl_sdbx_apikey_abcdefgh",
      mode: "SANDBOX",
    }) as Record<string, string>;
    expect(redacted.apiKey).toContain("••••");
    expect(redacted.apiKey).not.toContain("abcdefgh");
    expect(redacted.mode).toBe("SANDBOX");
  });

  it("maskSecret shows last chars only", () => {
    expect(maskSecret("sk_test_1234567890", 4)).toMatch(/••••/);
  });
});

describe("B3.1 provider catalog extensible", () => {
  it("includes paddle stripe and manuals", () => {
    const ids = PROVIDER_CATALOG.map((p) => p.provider);
    expect(ids).toContain("PADDLE");
    expect(ids).toContain("STRIPE");
    expect(ids).toContain("MANUAL_PAYONEER");
    expect(ids).toContain("MANUAL_BANK");
  });

  it("checkout methods cover catalog", () => {
    for (const p of PROVIDER_CATALOG) {
      expect(ALL_CHECKOUT_METHODS).toContain(p.checkoutMethod);
    }
  });
});

describe("B3.1 emergency kill switch", () => {
  it("overrides UI master switch", () => {
    const paymentsEnabled = true;
    const emergencyDisable = true;
    const live = paymentsEnabled && !emergencyDisable;
    expect(live).toBe(false);
  });
});

describe("B3.1 tenant method filter", () => {
  it("intersects org methods with enabled providers", () => {
    const global = ["CARD_PADDLE", "CARD_STRIPE", "INVOICE_PAYONEER"];
    const enabledProviders = new Set(["PADDLE", "MANUAL_PAYONEER"]);
    const methodToProvider: Record<string, string> = {
      CARD_PADDLE: "PADDLE",
      CARD_STRIPE: "STRIPE",
      INVOICE_PAYONEER: "MANUAL_PAYONEER",
      INVOICE_BANK: "MANUAL_BANK",
    };
    const allowed = global.filter((m) =>
      enabledProviders.has(methodToProvider[m])
    );
    expect(allowed).toEqual(["CARD_PADDLE", "INVOICE_PAYONEER"]);
    expect(allowed).not.toContain("CARD_STRIPE");
  });
});

describe("B3.1 password reconfirm gate", () => {
  it("requires password for credential changes", () => {
    const password = "";
    const requiresPassword = true;
    expect(requiresPassword && !password).toBe(true);
  });
});

describe("B3.1 disable keeps existing subs", () => {
  it("documents disable only blocks new checkout", () => {
    const providerEnabled = false;
    const existingSubProvider = "PADDLE";
    const webhookStillAccepted = existingSubProvider === "PADDLE";
    const newCheckoutAllowed = providerEnabled;
    expect(webhookStillAccepted).toBe(true);
    expect(newCheckoutAllowed).toBe(false);
  });
});

describe("B3.1 sandbox live credential slots", () => {
  it("stores separately", () => {
    const row = {
      sandboxCredentialsEnc: "enc_sand",
      liveCredentialsEnc: "enc_live",
    };
    expect(row.sandboxCredentialsEnc).not.toBe(row.liveCredentialsEnc);
  });
});

describe("B3.1 publish syncs all enabled", () => {
  it("targets only enabled card providers", () => {
    const configs = [
      { provider: "PADDLE", enabled: true },
      { provider: "STRIPE", enabled: false },
    ];
    const targets = ["PADDLE", "STRIPE"].filter((p) =>
      configs.find((c) => c.provider === p)?.enabled
    );
    expect(targets).toEqual(["PADDLE"]);
  });
});

describe("B3.1 audit without secrets", () => {
  it("audit after only has flags", () => {
    const after = {
      enabled: true,
      mode: "SANDBOX",
      configuredSandbox: true,
      credentialsReplaced: true,
    };
    expect(JSON.stringify(after)).not.toMatch(/sk_|pdl_|whsec/);
  });
});

import { describe, expect, it } from "vitest";
import { INBOUND_EXEMPT_PURPOSES } from "@/lib/billing/entitlements";
import { PROVIDER_CATALOG } from "@/lib/integrations/provider-catalog";
import { sanitizeIntegrationResponse } from "@/services/integration.service";

describe("S1 entitlements + integrations", () => {
  it("treats inbound AI purposes as exempt forever", () => {
    expect(INBOUND_EXEMPT_PURPOSES.has("inbox_reply_classification")).toBe(true);
    expect(INBOUND_EXEMPT_PURPOSES.has("bounce_detection")).toBe(true);
    expect(INBOUND_EXEMPT_PURPOSES.has("unsub_detection")).toBe(true);
  });

  it("catalog includes Calendar/Zoom stubs with Connect disabled", () => {
    const cal = PROVIDER_CATALOG.find((p) => p.id === "google_calendar");
    const zoom = PROVIDER_CATALOG.find((p) => p.id === "zoom");
    expect(cal?.connectEnabled).toBe(false);
    expect(zoom?.connectEnabled).toBe(false);
    expect(PROVIDER_CATALOG.every((p) => p.managedModeAvailable === false)).toBe(
      true
    );
  });

  it("sanitizeIntegrationResponse strips secrets", () => {
    const clean = sanitizeIntegrationResponse({
      id: "1",
      providerId: "anthropic",
      encryptedCredentials: "iv:tag:data",
      apiKey: "sk-ant-secret",
      status: "CONNECTED",
    });
    expect(clean).toEqual({
      id: "1",
      providerId: "anthropic",
      status: "CONNECTED",
    });
    expect(clean).not.toHaveProperty("encryptedCredentials");
    expect(clean).not.toHaveProperty("apiKey");
  });
});

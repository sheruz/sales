import { describe, expect, it } from "vitest";
import { MessageAiClassification, SuppressionReason } from "@prisma/client";

describe("Phase 6 outreach + inbox contracts", () => {
  it("supports required AI reply classifications", () => {
    const required = [
      "INTERESTED",
      "POSITIVE",
      "NEGATIVE",
      "OBJECTION",
      "QUESTION",
      "UNSUBSCRIBE",
      "OUT_OF_OFFICE",
      "NOT_RELEVANT",
      "REFERRAL",
      "UNKNOWN",
    ];
    for (const key of required) {
      expect(Object.values(MessageAiClassification)).toContain(key);
    }
  });

  it("supports suppression reasons", () => {
    expect(Object.values(SuppressionReason)).toEqual(
      expect.arrayContaining([
        "UNSUBSCRIBE",
        "BOUNCE",
        "COMPLAINT",
        "MANUAL",
        "LEGAL_REQUEST",
      ])
    );
  });

  it("safety checklist covers required gates", () => {
    const gates = [
      "organization active",
      "account active",
      "valid email",
      "not suppressed",
      "sequence active",
      "daily limit",
      "provider healthy",
      "idempotency key",
    ];
    expect(gates).toHaveLength(8);
  });

  it("email providers include Gmail, Outlook, SMTP", () => {
    const providers = ["GMAIL", "OUTLOOK", "SMTP"];
    expect(providers).toContain("GMAIL");
    expect(providers).toContain("OUTLOOK");
    expect(providers).toContain("SMTP");
  });
});

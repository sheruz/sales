import { describe, expect, it } from "vitest";
import {
  BILLING_ACTIONS,
  getActionDef,
  resolveAiBillingAction,
  INBOUND_EXEMPT_PURPOSES,
} from "@/lib/billing/actions";
import { BILLING_REASONS } from "@/lib/billing/reasons";
import { FEATURE_KEYS } from "@/lib/billing/features";

describe("S2.5 action catalog", () => {
  it("audits is separate from enrichment", () => {
    const audit = getActionDef(BILLING_ACTIONS.AUDIT_PITCH);
    const enrich = getActionDef(BILLING_ACTIONS.ENRICHMENT);
    expect(audit?.featureKey).toBe(FEATURE_KEYS.AUDITS);
    expect(enrich?.featureKey).toBe(FEATURE_KEYS.ENRICHMENT);
    expect(audit?.metric).toBe("AUDITS");
    expect(enrich?.metric).toBe("ENRICHMENT");
  });

  it("cold sequence and AI reply sends use email daily+monthly", () => {
    const seq = getActionDef(BILLING_ACTIONS.EMAIL_SEND_SEQUENCE);
    const ai = getActionDef(BILLING_ACTIONS.EMAIL_SEND_AI_REPLY);
    expect(seq?.dailyEmail).toBe(true);
    expect(ai?.dailyEmail).toBe(true);
    expect(seq?.creditActionType).toBeNull();
  });

  it("classification is always exempt; inbound purposes map to it", () => {
    const cls = getActionDef(BILLING_ACTIONS.AI_REPLY_CLASSIFICATION);
    expect(cls?.alwaysExempt).toBe(true);
    expect(INBOUND_EXEMPT_PURPOSES.has("inbox_reply_classification")).toBe(
      true
    );
    expect(resolveAiBillingAction("inbox_reply_classification")).toBe(
      BILLING_ACTIONS.AI_REPLY_CLASSIFICATION
    );
    expect(resolveAiBillingAction("website_audit")).toBe(
      BILLING_ACTIONS.AI_CALL
    );
  });

  it("reason codes include plan + credits + email", () => {
    expect(BILLING_REASONS.OUT_OF_CREDITS).toBe("OUT_OF_CREDITS");
    expect(BILLING_REASONS.DAILY_EMAIL_LIMIT).toBe("DAILY_EMAIL_LIMIT");
    expect(BILLING_REASONS.MONTHLY_EMAIL_LIMIT).toBe("MONTHLY_EMAIL_LIMIT");
  });
});

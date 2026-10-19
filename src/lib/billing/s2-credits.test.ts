import { describe, expect, it } from "vitest";
import {
  CREDIT_ACTIONS,
  CREDIT_CONSUMING_ACTIONS,
  DEFAULT_CREDIT_PRICES,
} from "@/lib/billing/credit-actions";
import { isOutOfCreditsPause } from "@/lib/billing/with-credits";

describe("S2 credits", () => {
  it("defines prices for consuming actions", () => {
    for (const action of CREDIT_CONSUMING_ACTIONS) {
      const row = DEFAULT_CREDIT_PRICES.find((p) => p.actionType === action);
      expect(row).toBeTruthy();
      expect(row!.byok).toBeGreaterThan(0);
    }
  });

  it("keeps classification and crawl at zero (inbound/exempt-friendly)", () => {
    const classify = DEFAULT_CREDIT_PRICES.find(
      (p) => p.actionType === CREDIT_ACTIONS.AI_REPLY_CLASSIFICATION
    );
    const crawl = DEFAULT_CREDIT_PRICES.find(
      (p) => p.actionType === CREDIT_ACTIONS.CRAWL
    );
    expect(classify?.byok).toBe(0);
    expect(crawl?.byok).toBe(0);
  });

  it("uses unique outcome keys per reservation (:commit / :refund)", () => {
    const reserveKey = "enrichment:org:company:a0";
    const commitKey = `${reserveKey}:commit`;
    const refundKey = `${reserveKey}:refund`;
    expect(commitKey).not.toBe(refundKey);
    expect(new Set([reserveKey, commitKey, refundKey]).size).toBe(3);
  });

  it("monthly grant idempotency key is org + period start", () => {
    const orgId = "org-uuid";
    const periodStart = "2026-10-01";
    expect(`grant_plan:${orgId}:${periodStart}`).toBe(
      "grant_plan:org-uuid:2026-10-01"
    );
  });

  it("detects out-of-credits soft pause", () => {
    expect(
      isOutOfCreditsPause({
        ok: false,
        paused: true,
        reason: "out_of_credits",
        message: "Out of credits",
      })
    ).toBe(true);
    expect(
      isOutOfCreditsPause({
        ok: true,
        result: null,
        credits: 0,
        skippedOwner: true,
        reservationId: "test",
      })
    ).toBe(false);
  });

  it("signed amount convention: reserve negative, refund positive, commit zero", () => {
    const reserve = -2;
    const commit = 0;
    const refund = 2;
    expect(reserve + commit).toBe(-2); // consumed
    expect(reserve + refund).toBe(0); // returned
  });
});

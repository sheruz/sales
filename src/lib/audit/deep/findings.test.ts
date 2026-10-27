import { describe, expect, it } from "vitest";
import {
  makeFinding,
  speedFindingFromPageSpeed,
} from "@/lib/audit/deep/findings";
import type { PageSpeedResult } from "@/lib/audit/pagespeed.adapter";

function psi(partial: Partial<PageSpeedResult> & { score?: number | null }): PageSpeedResult {
  return {
    strategy: "mobile",
    score: partial.score ?? null,
    metrics: {
      lcpMs: partial.metrics?.lcpMs ?? null,
      cls: null,
      tbtMs: null,
      fcpMs: null,
      siMs: null,
    },
    fieldMetrics: partial.fieldMetrics,
    error: partial.error,
  };
}

describe("speedFindingFromPageSpeed", () => {
  it("does not flag average LCP under 4s with score >= 50", () => {
    expect(
      speedFindingFromPageSpeed({
        psi: psi({ score: 67, metrics: { lcpMs: 2800, cls: null, tbtMs: null, fcpMs: null, siMs: null } }),
        playwrightMobileMs: 10_100,
      })
    ).toBeNull();
  });

  it("flags LCP > 4s as severity B never A", () => {
    const f = speedFindingFromPageSpeed({
      psi: psi({ score: 40, metrics: { lcpMs: 5200, cls: null, tbtMs: null, fcpMs: null, siMs: null } }),
    });
    expect(f?.severity).toBe("B");
    expect(f?.id).toBe("slow_mobile_psi");
  });

  it("High confidence when CrUX field also poor", () => {
    const f = speedFindingFromPageSpeed({
      psi: psi({
        score: 35,
        metrics: { lcpMs: 5100, cls: null, tbtMs: null, fcpMs: null, siMs: null },
        fieldMetrics: { lcpMs: 4800, category: "SLOW" },
      }),
    });
    expect(f?.confidence).toBe("High");
    expect(f?.emailEligible).toBe(true);
  });

  it("Medium when only lab is poor", () => {
    const f = speedFindingFromPageSpeed({
      psi: psi({
        score: 45,
        metrics: { lcpMs: 4500, cls: null, tbtMs: null, fcpMs: null, siMs: null },
      }),
    });
    expect(f?.confidence).toBe("Medium");
    expect(f?.emailEligible).toBe(false);
  });
});

describe("makeFinding emailEligible", () => {
  it("A broken findings are High and email-eligible", () => {
    const f = makeFinding({
      id: "http_error",
      severity: "A",
      title: "Homepage returns an error",
      whyItMatters: "Visitors see a broken page.",
      evidence: "HTTP 500",
      confidence: "High",
    });
    expect(f.emailEligible).toBe(true);
  });
});

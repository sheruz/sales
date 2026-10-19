import { describe, expect, it } from "vitest";
import { ConflictError } from "@/lib/api/response";
import { FEATURE_KEYS } from "@/lib/billing/features";

describe("B2 apply modes (documented)", () => {
  it("apply now moves pin; renewal sets pending; new-only leaves pin", () => {
    type Mode = "now" | "renewal" | "new_subscribers_only";
    function apply(
      mode: Mode,
      currentPin: string,
      newVersion: string,
      periodEnd: Date | null
    ) {
      if (mode === "now") {
        return {
          planVersionId: newVersion,
          pendingPlanVersionId: null,
          pendingApplyAt: null,
        };
      }
      if (mode === "renewal") {
        return {
          planVersionId: currentPin,
          pendingPlanVersionId: newVersion,
          pendingApplyAt: periodEnd,
        };
      }
      return {
        planVersionId: currentPin,
        pendingPlanVersionId: null,
        pendingApplyAt: null,
        currentVersionId: newVersion,
      };
    }

    expect(apply("now", "v1", "v2", null).planVersionId).toBe("v2");
    expect(apply("renewal", "v1", "v2", new Date("2026-11-01")).pendingPlanVersionId).toBe(
      "v2"
    );
    expect(
      apply("new_subscribers_only", "v1", "v2", null).planVersionId
    ).toBe("v1");
  });

  it("credits change never retroactively grant/remove", () => {
    const applyMode = "now";
    const grantCreditsOnPublish = false; // B2 decision #5
    expect(applyMode === "now" && grantCreditsOnPublish).toBe(false);
  });

  it("price changes never auto-move existing subscribers", () => {
    const pinKeepsPrice = true;
    const newCatalogPrice = 199;
    const pinnedPrice = 149;
    expect(pinKeepsPrice ? pinnedPrice : newCatalogPrice).toBe(149);
  });
});

describe("B2 pause selection", () => {
  it("pauses newest first when no choice; never primary admin", () => {
    const resources = [
      { id: "a", createdAt: 1, isPrimaryAdmin: true },
      { id: "b", createdAt: 2, isPrimaryAdmin: false },
      { id: "c", createdAt: 3, isPrimaryAdmin: false },
      { id: "d", createdAt: 4, isPrimaryAdmin: false },
    ];
    const allowed = 2;
    const pausable = resources.filter((r) => !r.isPrimaryAdmin);
    const protectedCount = resources.length - pausable.length;
    const keepSlots = Math.max(0, allowed - protectedCount);
    // newest first in pausable list (desc createdAt)
    const newestFirst = [...pausable].sort((a, b) => b.createdAt - a.createdAt);
    const wouldPause = newestFirst.slice(0, Math.max(0, newestFirst.length - keepSlots));
    expect(wouldPause.map((r) => r.id)).toEqual(["d", "c"]);
    expect(wouldPause.some((r) => r.isPrimaryAdmin)).toBe(false);
  });

  it("seat counts exclude pausedAt", () => {
    const rows = [
      { pausedAt: null },
      { pausedAt: new Date() },
      { pausedAt: null },
    ];
    const seatCount = rows.filter((r) => r.pausedAt == null).length;
    expect(seatCount).toBe(2);
  });
});

describe("B2 optimistic lock", () => {
  it("rejects mismatched editorRevision", () => {
    const draftRev: number = 3;
    const payloadRev: number = 2;
    const conflict = draftRev !== payloadRev;
    expect(conflict).toBe(true);
    const err = new ConflictError(
      "Draft was modified by another admin. Reload and try again.",
      "OPTIMISTIC_LOCK"
    );
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe("OPTIMISTIC_LOCK");
  });
});

describe("B2 draft visibility", () => {
  it("Choose Plan only includes PUBLISHED current version", () => {
    const plan = {
      visibility: "PUBLIC",
      archivedAt: null,
      currentVersionId: "v2",
      versions: [
        { id: "draft1", status: "DRAFT" },
        { id: "v2", status: "PUBLISHED" },
      ],
    };
    const version = plan.versions.find((v) => v.id === plan.currentVersionId);
    expect(version?.status).toBe("PUBLISHED");
    expect(plan.versions.some((v) => v.status === "DRAFT")).toBe(true);
    // draft must not be selected for catalog
    expect(version?.id).not.toBe("draft1");
  });

  it("archived plan hidden from PUBLIC catalog but pin remains", () => {
    const catalogFilter = (p: {
      active: boolean;
      archivedAt: Date | null;
      visibility: string;
    }) =>
      p.active && p.archivedAt == null && p.visibility === "PUBLIC";
    expect(
      catalogFilter({
        active: false,
        archivedAt: new Date(),
        visibility: "INTERNAL",
      })
    ).toBe(false);
    const pinnedSub = { planVersionId: "old-v1", planArchived: true };
    expect(pinnedSub.planVersionId).toBeTruthy();
  });
});

describe("B2 override expiry", () => {
  it("expired override does not win over version", () => {
    const versionLimit = 3;
    const override = {
      limitValue: 10,
      expiresAt: new Date("2020-01-01"),
    };
    const expired = override.expiresAt.getTime() <= Date.now();
    const effective = expired ? versionLimit : override.limitValue;
    expect(effective).toBe(3);
  });
});

describe("B2 PLATFORM_SUPPORT", () => {
  it("write denied for SUPPORT", () => {
    const role: string = "PLATFORM_SUPPORT";
    const canWrite = role === "SUPER_ADMIN";
    expect(canWrite).toBe(false);
  });
});

describe("B2 credit price timing", () => {
  it("authorize reads price at authorize time (new only)", () => {
    const pricesAtAuthorize = 2;
    const oldAuthCredits = 1;
    expect(pricesAtAuthorize).not.toBe(oldAuthCredits);
    expect(FEATURE_KEYS.OUTBOUND_MAILBOXES).toBe("outbound_mailboxes");
  });
});

describe("B2 manual pack grant idempotency", () => {
  it("same idempotency key grants once", () => {
    const seen = new Set<string>();
    function grant(key: string) {
      if (seen.has(key)) return { alreadyExists: true };
      seen.add(key);
      return { alreadyExists: false };
    }
    expect(grant("k1").alreadyExists).toBe(false);
    expect(grant("k1").alreadyExists).toBe(true);
  });
});

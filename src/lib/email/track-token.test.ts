import { describe, expect, it } from "vitest";
import {
  clickTrackUrl,
  createTrackToken,
  openPixelUrl,
  verifyTrackToken,
  withEmailUtm,
} from "@/lib/email/track-token";

describe("email track tokens", () => {
  it("round-trips open payload", () => {
    const token = createTrackToken({
      v: 1,
      kind: "o",
      organizationId: "org-1",
      outboxId: "out-1",
      exp: Date.now() + 60_000,
    });
    const parsed = verifyTrackToken(token);
    expect(parsed?.kind).toBe("o");
    if (parsed?.kind === "o") {
      expect(parsed.outboxId).toBe("out-1");
    }
  });

  it("rejects bad signature", () => {
    const token = createTrackToken({
      v: 1,
      kind: "o",
      organizationId: "org-1",
      outboxId: "out-1",
      exp: Date.now() + 60_000,
    });
    expect(verifyTrackToken(token + "x")).toBeNull();
  });

  it("builds open + click URLs", () => {
    expect(
      openPixelUrl({ organizationId: "o", outboxId: "x" })
    ).toContain("/t/o/");
    expect(
      clickTrackUrl({
        organizationId: "o",
        outboxId: "x",
        linkType: "whatsapp",
        destUrl: "https://wa.me/12105550100",
      })
    ).toContain("/t/c/");
  });

  it("appends UTM params for http destinations", () => {
    const u = withEmailUtm("https://delvix.studio/pricing", {
      campaign: "cold_outreach",
      content: "cta",
      outboxId: "abcdef12-xxxx",
    });
    expect(u).toContain("utm_source=email");
    expect(u).toContain("utm_medium=email");
    expect(u).toContain("utm_content=cta");
  });
});

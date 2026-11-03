import { describe, expect, it } from "vitest";
import {
  createPowPreviewToken,
  mintPowPreview,
  verifyPowPreviewToken,
} from "@/lib/pow/preview-token";

describe("pow preview token", () => {
  it("round-trips a valid token", () => {
    const exp = Date.now() + 60_000;
    const token = createPowPreviewToken({
      v: 1,
      kind: "pow_preview",
      organizationId: "org-1",
      evidenceId: "ev-1",
      pitchId: "pitch-1",
      exp,
    });
    const parsed = verifyPowPreviewToken(token);
    expect(parsed?.evidenceId).toBe("ev-1");
    expect(parsed?.pitchId).toBe("pitch-1");
  });

  it("rejects tampered signature", () => {
    const token = createPowPreviewToken({
      v: 1,
      kind: "pow_preview",
      organizationId: "org-1",
      evidenceId: "ev-1",
      pitchId: "pitch-1",
      exp: Date.now() + 60_000,
    });
    const [payload] = token.split(".");
    expect(verifyPowPreviewToken(`${payload}.aaaa`)).toBeNull();
  });

  it("rejects expired tokens", () => {
    const token = createPowPreviewToken({
      v: 1,
      kind: "pow_preview",
      organizationId: "org-1",
      evidenceId: "ev-1",
      pitchId: "pitch-1",
      exp: Date.now() - 1000,
    });
    expect(verifyPowPreviewToken(token)).toBeNull();
  });

  it("mintPowPreview caps expiry by evidence expiresAt", () => {
    const soon = new Date(Date.now() + 60_000);
    const minted = mintPowPreview({
      organizationId: "org-1",
      evidenceId: "ev-1",
      pitchId: "pitch-1",
      expiresAt: soon,
      ttlMs: 60 * 864e5,
    });
    expect(minted.exp).toBeLessThanOrEqual(soon.getTime());
    expect(minted.url).toContain("/api/pow/preview/");
  });

  it("mintPowPreview with publicSlug uses /for/ page URL", () => {
    const minted = mintPowPreview({
      organizationId: "org-1",
      evidenceId: "ev-1",
      pitchId: "pitch-1",
      publicSlug: "acme-ab12cd34",
      ttlMs: 60_000,
    });
    expect(minted.url).toContain("/for/acme-ab12cd34");
  });
});

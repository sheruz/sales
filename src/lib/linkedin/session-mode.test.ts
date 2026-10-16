import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config/env", () => ({
  env: { LINKEDIN_SESSION_ENABLED: false },
}));

describe("LinkedIn SESSION mode flag", () => {
  it("is disabled by default (S1)", async () => {
    const { isLinkedInSessionEnabled } = await import("./session-mode");
    expect(isLinkedInSessionEnabled()).toBe(false);
  });

  it("exposes a clear disabled message", async () => {
    const { LINKEDIN_SESSION_DISABLED_MESSAGE } = await import("./session-mode");
    expect(LINKEDIN_SESSION_DISABLED_MESSAGE).toMatch(/cookie\/session mode is disabled/i);
    expect(LINKEDIN_SESSION_DISABLED_MESSAGE).toMatch(/OAuth/i);
  });
});

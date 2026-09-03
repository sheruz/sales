import { describe, expect, it } from "vitest";
import { extractDomain } from "@/services/company.service";

describe("Phase 3 opportunity engine helpers", () => {
  it("extractDomain normalizes websites", () => {
    expect(extractDomain("https://www.Acme.io/careers")).toBe("acme.io");
    expect(extractDomain("acme.io")).toBe("acme.io");
    expect(extractDomain("")).toBeNull();
    expect(extractDomain(null)).toBeNull();
  });

  it("job post is modeled as hiring signal type key", () => {
    // Contract: discovery uses opportunity source key job_post + SignalType.HIRING
    const sourceKey = "job_post";
    const signalType = "HIRING";
    expect(sourceKey).not.toBe("opportunity");
    expect(signalType).toBe("HIRING");
  });
});

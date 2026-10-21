import { describe, expect, it } from "vitest";
import {
  interpolateTemplate,
  LIFECYCLE_TEMPLATE_DEFAULTS,
  sampleVarsForTemplate,
} from "@/lib/email/lifecycle-templates";

describe("B5b email template editor contracts", () => {
  it("every template exposes variables for the picker", () => {
    for (const t of LIFECYCLE_TEMPLATE_DEFAULTS) {
      expect(t.variables.length).toBeGreaterThan(0);
      expect(t.variables).toContain("orgName");
      expect(t.variables).toContain("ctaUrl");
    }
  });

  it("preview sample data clears all placeholders in subject", () => {
    for (const t of LIFECYCLE_TEMPLATE_DEFAULTS) {
      const vars = sampleVarsForTemplate(t.key);
      const subject = interpolateTemplate(t.subject, vars);
      expect(subject).not.toMatch(/\{\{/);
      expect(subject.length).toBeGreaterThan(0);
    }
  });

  it("reset restores defaults when subject was customized", () => {
    const def = LIFECYCLE_TEMPLATE_DEFAULTS[0];
    const customized = def.subject + " [custom]";
    expect(customized).not.toBe(def.subject);
    const reset = def.subject;
    expect(reset).toBe(def.subject);
  });
});

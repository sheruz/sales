import { describe, expect, it } from "vitest";
import {
  buildPowFooter,
  buildPowTemplateVars,
  powRequiredVarsForTemplate,
} from "@/lib/pow/merge-vars";
import { renderSequenceTemplateDetailed } from "@/lib/sequences/runtime";
const draft = {
  steps: [
    { day: 0 as const, subject: "form on example.com", body: "Hi Team\n\nline\n\n{{preview_url}}" },
    { day: 3 as const, subject: "follow", body: "Day 3 body" },
    { day: 7 as const, subject: "case", body: "Day 7 body" },
    { day: 14 as const, subject: "bye", body: "Day 14 body" },
  ],
};

describe("pow merge vars", () => {
  it("fills subject/body/footer/preview", () => {
    const vars = buildPowTemplateVars({
      draft,
      previewUrl: "https://app.example/p/t",
      footer: buildPowFooter({
        senderName: "Alex",
        businessName: "Acme",
        businessAddress: "1 Main St",
        unsubscribeUrl: "https://app.example/u",
      }),
    });
    expect(vars.pow_subject_day0).toBe("form on example.com");
    expect(vars.pow_body_day3).toBe("Day 3 body");
    expect(vars.preview_url).toContain("https://");
    expect(vars.pow_footer).toContain("Unsubscribe:");
  });

  it("renders day0 template without leftover braces", () => {
    const vars = buildPowTemplateVars({
      draft,
      previewUrl: "https://app.example/preview",
      footer: "Alex\nUnsubscribe: https://u",
    });
    const template = `{{pow_body_day0}}\n\n{{preview_url}}\n\n{{pow_footer}}`;
    const required = powRequiredVarsForTemplate(template);
    const rendered = renderSequenceTemplateDetailed(template, vars, required);
    expect(rendered.missingRequired).toEqual([]);
    expect(rendered.text).not.toMatch(/\{\{/);
    expect(rendered.text).toContain("https://app.example/preview");
  });
});

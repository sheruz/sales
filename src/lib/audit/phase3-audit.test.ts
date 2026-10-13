import { describe, expect, it } from "vitest";
import {
  failingChecks,
  runRuleChecks,
  type CheckResult,
} from "@/lib/audit/rule-checks";
import {
  validatePitchAiResult,
} from "@/lib/audit/pitch-prompt";
import {
  buildSequenceTemplateVars,
  renderSequenceTemplate,
  renderSequenceTemplateDetailed,
  TEMPLATE_FALLBACKS,
} from "@/lib/sequences/runtime";
import { isEnrollableVerification } from "@/lib/enrichment/verification";

describe("rule checks", () => {
  it("detects SSL, viewport, meta, form signals", async () => {
    const html = `
      <html><head>
        <meta name="viewport" content="width=device-width">
        <meta name="description" content="We manage rental properties across the city with care.">
      </head><body>
        <a href="https://facebook.com/acme">FB</a>
        <form><input type="email" /></form>
        <p>Copyright © 2019 Acme</p>
        <a href="/contact">Contact</a>
      </body></html>
    `;
    const checks = await runRuleChecks({
      homepageUrl: "https://example.com/",
      finalUrl: "https://example.com/",
      html,
      pageSpeedMobile: 42,
      pageSpeedDesktop: 55,
      industries: ["property management"],
    });
    const byId = Object.fromEntries(checks.map((c) => [c.id, c]));
    expect(byId.ssl.pass).toBe(true);
    expect(byId.mobile_viewport.pass).toBe(true);
    expect(byId.meta_description.pass).toBe(true);
    expect(byId.contact_form.pass).toBe(true);
    expect(byId.load_speed.pass).toBe(false);
    expect(byId.copyright_year.pass).toBe(false);
    expect(byId.property_listings).toBeTruthy();
    expect(failingChecks(checks).some((c) => c.id === "load_speed")).toBe(
      true
    );
  });
});

describe("pitch prompt validation", () => {
  const checks: CheckResult[] = [
    {
      id: "load_speed",
      label: "Mobile PageSpeed",
      pass: false,
      evidence: "Mobile performance score 32/100",
      severity: "fail",
    },
    {
      id: "contact_form",
      label: "Contact form",
      pass: false,
      evidence: "No clear contact form markup on homepage",
      severity: "warn",
    },
  ];

  it("accepts grounded JSON", () => {
    const raw = {
      top_issues: [
        {
          issue: "Slow mobile experience",
          evidence: "Mobile performance score 32/100",
          business_impact: "Prospects bounce before converting",
        },
      ],
      recommended_service: "Website redesign",
      personalized_first_line:
        "Hi Alex — noticed the mobile score sits at 32, which often costs leads.",
      short_pitch:
        "We help property managers fix speed and conversion gaps. Happy to share a short teardown.",
      confidence: 72,
      greeting: "Hi Alex,",
      intro_html:
        "<p>I was reviewing acme.com and noticed the mobile experience may be costing leads.</p>",
      finding_title: "Mobile visitors may bounce early",
      finding_text:
        "A low mobile score often means fewer inquiries from people browsing on the go.",
      body_html:
        "<p>We help property managers fix speed and conversion gaps. Happy to share a short teardown.</p>",
      preheader: "A quick note on your mobile site speed",
    };
    const result = validatePitchAiResult(raw, checks);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.finding_title).not.toMatch(/detected/i);
    }
  });

  it("rejects invented evidence", () => {
    const raw = {
      top_issues: [
        {
          issue: "Broken checkout",
          evidence: "Cart abandons at payment step with stripe errors",
          business_impact: "Lost sales",
        },
      ],
      recommended_service: "Website redesign",
      personalized_first_line: "Hi there, quick note about your site.",
      short_pitch: "We can help.",
      confidence: 40,
    };
    const result = validatePitchAiResult(raw, checks);
    expect(result.ok).toBe(false);
  });

  it("rejects first lines over 40 words", () => {
    const long =
      "Hi Alex " +
      Array.from({ length: 45 }, () => "word").join(" ");
    const result = validatePitchAiResult(
      {
        top_issues: [
          {
            issue: "Slow mobile",
            evidence: "Mobile performance score 32/100",
            business_impact: "Bounce",
          },
        ],
        recommended_service: "Website redesign",
        personalized_first_line: long,
        short_pitch: "We can help with speed.",
        confidence: 50,
      },
      checks
    );
    expect(result.ok).toBe(false);
  });
});

describe("only-enriched filter helpers", () => {
  it("requires enrollable verification", () => {
    expect(isEnrollableVerification("valid")).toBe(true);
    expect(isEnrollableVerification("accept_all", false)).toBe(false);
    expect(isEnrollableVerification("accept_all", true)).toBe(true);
    expect(isEnrollableVerification("invalid")).toBe(false);
  });
});

describe("template variable rendering", () => {
  it("keeps nested vars and adds flat aliases", () => {
    const vars = buildSequenceTemplateVars({
      contact: { firstName: "Alex" },
      company: { name: "Acme Prop", city: "Dallas" },
      pitch: {
        personalizedFirstLine: "Saw your mobile score.",
        shortPitch: "We fix websites.",
        topIssue: "Slow mobile",
        recommendedService: "Website redesign",
      },
    });
    expect(vars["contact.firstName"]).toBe("Alex");
    expect(vars.first_name).toBe("Alex");
    expect(vars.company_name).toBe("Acme Prop");
    expect(vars.personalized_first_line).toBe("Saw your mobile score.");
  });

  it("never renders blank or raw mustaches for missing required vars", () => {
    const template =
      "Hi {{first_name}}, {{personalized_first_line}} — {{company_name}} in {{city}}.";
    const detailed = renderSequenceTemplateDetailed(template, {});
    expect(detailed.text).not.toMatch(/\{\{/);
    expect(detailed.text).toContain(TEMPLATE_FALLBACKS.first_name);
    expect(detailed.text).toContain(TEMPLATE_FALLBACKS.company_name);
    expect(detailed.missingRequired).toEqual(
      expect.arrayContaining(["first_name", "personalized_first_line", "company_name"])
    );
    expect(renderSequenceTemplate(template, {})).toBe(detailed.text);
  });
});

import { readFileSync } from "fs";
import { join } from "path";
import { beforeAll, describe, expect, it } from "vitest";
import { BRANDED_OUTBOUND_HTML } from "@/lib/email/templates/branded-outbound.template";
import { renderOutboundEmail } from "@/lib/email/render-outbound";
import type { ResolvedSender } from "@/lib/email/branding";

// Vite may not load .env before first `env` access in this file's worker
beforeAll(() => {
  process.env.APP_URL ||= "http://localhost:3000";
  process.env.DATABASE_URL ||=
    "postgresql://user:pass@localhost:5432/sales_platform_test";
  process.env.JWT_SECRET ||= "test-jwt-secret-at-least-32-chars!!";
});

const DELVIX_RE = /delvix|delvixstudio\.com/i;

function assertNoDelvix(label: string, text: string) {
  expect(text, label).not.toMatch(DELVIX_RE);
}

describe("B3 tenant outbound templates — no Delvix hardcodes", () => {
  it("inlined BRANDED_OUTBOUND_HTML has no Delvix / delvixstudio.com", () => {
    assertNoDelvix("template.ts", BRANDED_OUTBOUND_HTML);
  });

  it("branded-outbound.html source has no Delvix / delvixstudio.com", () => {
    const htmlPath = join(
      process.cwd(),
      "src/lib/email/templates/branded-outbound.html"
    );
    const html = readFileSync(htmlPath, "utf8");
    assertNoDelvix("branded-outbound.html", html);
  });
});

const blankSender: ResolvedSender = {
  senderName: "",
  senderTitle: "",
  senderPhotoUrl: null,
  logoUrl: null,
  websiteUrl: "",
  websiteLabel: "",
  whatsappDigits: "",
  whatsappDisplay: "",
  ctaUrl: "#",
  ctaLabel: "Book a call",
  footerServices: "",
  availabilityLine: "",
  companyLegalName: "",
  businessAddress: "",
};

describe("B3 new org outbound render uses only tenant branding", () => {
  it("render with blank defaults contains no Delvix", () => {
    const out = renderOutboundEmail({
      style: "BRANDED",
      subject: "Quick idea",
      pitch: {
        greeting: "Hi there,",
        preheader: "A note",
        introHtml: "<p>Intro</p>",
        findingTitle: "Finding",
        findingText: "Detail",
        bodyHtml: "<p>Body</p>",
      },
      company: { name: "Prospect Co", domain: "prospect.test" },
      contact: { firstName: "Sam", email: "sam@prospect.test" },
      sender: blankSender,
      unsubscribeUrl: "https://example.com/unsub",
      track: {
        organizationId: "org-new",
        outboxId: "outbox-1",
      },
    });
    assertNoDelvix("html", out.html);
    assertNoDelvix("text", out.text);
    expect(out.html).not.toContain("SOFTWARE STUDIO");
  });

  it("render with Acme branding only shows Acme — never Delvix", () => {
    const sender: ResolvedSender = {
      senderName: "Jordan Lee",
      senderTitle: "Founder",
      senderPhotoUrl: "https://cdn.example/acme/sender.png",
      logoUrl: "https://cdn.example/acme/logo.png",
      websiteUrl: "https://acme.test",
      websiteLabel: "acme.test",
      whatsappDigits: "15551234567",
      whatsappDisplay: "+1 555 123 4567",
      ctaUrl: "https://cal.acme.test/book",
      ctaLabel: "Book a call",
      footerServices: "Apps · Sites",
      availabilityLine: "OPEN FOR PROJECTS",
      companyLegalName: "Acme Digital LLC",
      businessAddress: "100 Market St, SF, CA",
    };
    const out = renderOutboundEmail({
      style: "BRANDED",
      subject: "Site idea for Prospect",
      pitch: {
        greeting: "Hi Sam,",
        preheader: "Acme note",
        introHtml: "<p>We reviewed your site.</p>",
        findingTitle: "Checkout friction",
        findingText: "Cart drop-off is high.",
        bodyHtml: "<p>Happy to share a fix plan.</p>",
      },
      company: { name: "Prospect Co", domain: "prospect.test" },
      contact: { firstName: "Sam", email: "sam@prospect.test" },
      sender,
      unsubscribeUrl: "https://acme.test/unsub",
      track: {
        organizationId: "org-acme",
        outboxId: "outbox-acme-1",
      },
    });
    assertNoDelvix("html", out.html);
    assertNoDelvix("text", out.text);
    expect(out.html).toContain("Acme Digital LLC");
    expect(out.html).toContain("Jordan Lee");
    expect(out.html).toContain("acme.test");
    expect(out.html).toContain("100 Market St");
  });
});

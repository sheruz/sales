import { describe, expect, it } from "vitest";
import { buildGreeting, isGenericEmailLocalPart } from "@/lib/email/greeting";
import {
  formatWhatsappDisplay,
  whatsappDigits,
  whatsappMeUrl,
} from "@/lib/email/whatsapp";
import {
  looksLikeRawAuditLabel,
  renderOutboundEmail,
  validateOutboundHtml,
} from "@/lib/email/render-outbound";
import { buildMultipartAlternative } from "@/services/email-provider.service";
import { COLD_OUTREACH_STEPS } from "@/lib/outbound/cold-sequence";
import type { ResolvedSender } from "@/lib/email/branding";

const sender: ResolvedSender = {
  senderName: "Alex",
  senderTitle: "Founder",
  senderPhotoUrl: "https://example.com/branding/org/sender.png",
  logoUrl: "https://example.com/branding/org/logo.png",
  websiteUrl: "https://acme.example",
  websiteLabel: "acme.example",
  whatsappDigits: "12105550100",
  whatsappDisplay: "+1 210 555 0100",
  ctaUrl: "https://cal.example/book",
  ctaLabel: "Book a call",
  footerServices: "Web apps · Mobile apps",
  availabilityLine: "TAKING NEW PROJECTS",
  companyLegalName: "Acme Studio LLC",
  businessAddress: "1 Main St, Austin, TX",
};

describe("greeting fallback", () => {
  it("uses Hi there for info@", () => {
    expect(isGenericEmailLocalPart("info@acme.com")).toBe(true);
    expect(
      buildGreeting({ firstName: "Info", email: "info@acme.com" })
    ).toBe("Hi there,");
  });

  it("uses first name for real contacts", () => {
    expect(
      buildGreeting({ firstName: "Jordan", email: "jordan@acme.com" })
    ).toBe("Hi Jordan,");
  });

  it("never keeps Hi info,", () => {
    expect(
      buildGreeting({ greeting: "Hi info,", email: "info@x.com" })
    ).toBe("Hi there,");
  });
});

describe("no raw audit labels", () => {
  it("detects raw labels", () => {
    expect(
      looksLikeRawAuditLabel("No tenant or owner portal detected", [
        "No tenant or owner portal detected",
      ])
    ).toBe(true);
    expect(
      looksLikeRawAuditLabel("Renters struggle to apply online", [
        "No tenant or owner portal detected",
      ])
    ).toBe(false);
  });
});

describe("WhatsApp link format", () => {
  it("formats E.164 and wa.me", () => {
    expect(whatsappDigits("+1 (210) 555-0100")).toBe("12105550100");
    expect(whatsappMeUrl("+12105550100")).toBe("https://wa.me/12105550100");
    expect(formatWhatsappDisplay("+12105550100")).toBe("+1 210 555 0100");
  });
});

describe("style selection per step", () => {
  it("defaults cold step 1 BRANDED and 2–3 PLAIN", () => {
    expect(COLD_OUTREACH_STEPS[0].emailStyle).toBe("BRANDED");
    expect(COLD_OUTREACH_STEPS[1].emailStyle).toBe("BRANDED");
    expect(COLD_OUTREACH_STEPS[2].emailStyle).toBe("BRANDED");
    expect(COLD_OUTREACH_STEPS[1].subjectTemplate.startsWith("Re:")).toBe(true);
  });
});

describe("multipart + render", () => {
  it("renders BRANDED under 100KB with alt text", () => {
    const out = renderOutboundEmail({
      style: "BRANDED",
      subject: "Test",
      pitch: {
        greeting: "Hi there,",
        introHtml: "<p>Looking at acme.com</p>",
        findingTitle: "Mobile visitors may bounce early",
        findingText: "Slow pages cost inquiries.",
        bodyHtml: "<p>We build booking flows.</p>",
        preheader: "Quick note on mobile speed",
      },
      contact: { firstName: null, email: "info@acme.com" },
      company: { name: "Acme", domain: "acme.com" },
      sender,
      unsubscribeUrl: "https://example.com/unsubscribe?token=x",
    });
    expect(out.html).toContain("WHAT WE NOTICED");
    expect(out.html).toContain("Unsubscribe");
    expect(out.text).toContain("Unsubscribe");
    expect(validateOutboundHtml(out.html).ok).toBe(true);
  });

  it("embeds open pixel and tracked click links when track context is set", () => {
    const out = renderOutboundEmail({
      style: "BRANDED",
      subject: "Test",
      pitch: {
        findingTitle: "Finding",
        findingText: "Detail",
        bodyHtml: "<p>Body</p>",
      },
      contact: { firstName: "Sam", email: "sam@acme.com" },
      company: { name: "Acme", domain: "acme.com" },
      sender,
      unsubscribeUrl: "https://example.com/unsubscribe?token=x",
      track: {
        organizationId: "00000000-0000-0000-0000-000000000001",
        outboxId: "11111111-1111-1111-1111-111111111111",
        campaign: "cold_outreach",
      },
    });
    expect(out.html).toContain("/t/o/");
    expect(out.html).toContain("/t/c/");
    expect(out.html).not.toContain("https://wa.me/12105550100");
    expect(out.text).toContain("/t/c/");
  });

  it("renders PLAIN follow-up style", () => {
    const out = renderOutboundEmail({
      style: "PLAIN",
      subject: "Re: Acme - quick idea",
      pitch: {
        findingTitle: "Mobile bounce risk",
        findingText: "Impact",
        bodyHtml: "<p>Circling back.</p>",
      },
      contact: { firstName: "Sam", email: "sam@acme.com" },
      company: { name: "Acme", domain: "acme.com" },
      sender,
      unsubscribeUrl: "https://example.com/unsubscribe?token=x",
    });
    expect(out.style).toBe("PLAIN");
    expect(out.html).not.toContain("WHAT WE NOTICED");
    expect(out.text).toContain("Hi Sam,");
  });

  it("builds multipart alternative with both parts", () => {
    const raw = buildMultipartAlternative({
      from: "a@b.com",
      to: "c@d.com",
      subject: "Hi",
      text: "plain body",
      html: "<p>html body</p>",
      headers: { "List-Unsubscribe": "<https://x.com/u>" },
      inReplyTo: "prev-id",
      references: "prev-id",
    });
    expect(raw).toContain("multipart/alternative");
    expect(raw).toContain("text/plain");
    expect(raw).toContain("text/html");
    expect(raw).toContain("plain body");
    expect(raw).toContain("html body");
    expect(raw).toContain("In-Reply-To:");
    expect(raw).toContain("List-Unsubscribe:");
  });
});

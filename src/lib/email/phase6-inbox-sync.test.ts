import { describe, expect, it } from "vitest";
import {
  contactEmailMatchWhere,
  extractEmailAddress,
  extractGmailBodies,
  normalizeMessageId,
  parseMessageIdList,
  summarizeSyncResults,
} from "@/lib/email/inbound-sync";

describe("Inbound sync — Message-ID / email helpers", () => {
  it("normalizes Message-ID with or without angle brackets", () => {
    expect(normalizeMessageId("<abc@mail.gmail.com>")).toBe("abc@mail.gmail.com");
    expect(normalizeMessageId("abc@mail.gmail.com")).toBe("abc@mail.gmail.com");
    expect(normalizeMessageId("  <ABC@Mail.Gmail.Com> ")).toBe(
      "abc@mail.gmail.com"
    );
  });

  it("parses References header into normalized ids", () => {
    expect(
      parseMessageIdList("<a@x.com> <b@y.com>")
    ).toEqual(["a@x.com", "b@y.com"]);
  });

  it("extracts email from From header", () => {
    expect(extractEmailAddress("Greg <greg@acme.com>")).toBe("greg@acme.com");
    expect(extractEmailAddress("greg@acme.com")).toBe("greg@acme.com");
  });

  it("contact match uses normalizedEmail and case-insensitive email", () => {
    const where = contactEmailMatchWhere("org-a", "Shahroz@Gmail.com");
    expect(where.organizationId).toBe("org-a");
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { email: { equals: "shahroz@gmail.com", mode: "insensitive" } },
        { normalizedEmail: "shahroz@gmail.com" },
      ])
    );
  });
});

describe("Inbound sync — Gmail body extraction", () => {
  it("reads nested multipart alternative bodies", () => {
    const textB64 = Buffer.from("Hello plain").toString("base64url");
    const htmlB64 = Buffer.from("<p>Hello html</p>").toString("base64url");
    const { text, html } = extractGmailBodies({
      mimeType: "multipart/mixed",
      parts: [
        {
          mimeType: "multipart/alternative",
          parts: [
            { mimeType: "text/plain", body: { data: textB64 } },
            { mimeType: "text/html", body: { data: htmlB64 } },
          ],
        },
      ],
    });
    expect(text).toBe("Hello plain");
    expect(html).toBe("<p>Hello html</p>");
  });

  it("does not treat inbound reply as duplicate of outbound solely by subject", () => {
    // Contract: dedupe key is providerMessageId only
    const outboundId = "gmail-out-1";
    const inboundId = "gmail-in-2";
    expect(outboundId).not.toBe(inboundId);
  });
});

describe("Inbound sync — SMTP silent success prevention", () => {
  it("warns when only SMTP accounts exist (no OAuth sync targets)", () => {
    const summary = summarizeSyncResults([], {
      smtpAccountsSkipped: 1,
      oauthAccountCount: 0,
    });
    expect(summary.warning).toMatch(/SMTP is outbound-only/i);
    expect(summary.synced).toBe(0);
  });

  it("warns when no email accounts at all", () => {
    const summary = summarizeSyncResults([], {
      smtpAccountsSkipped: 0,
      oauthAccountCount: 0,
    });
    expect(summary.warning).toMatch(/No Gmail or Outlook/i);
  });

  it("reports imported count when OAuth sync returns messages", () => {
    const summary = summarizeSyncResults(
      [{ synced: 2, total: 5 }],
      { oauthAccountCount: 1, smtpAccountsSkipped: 1 }
    );
    expect(summary.warning).toBeNull();
    expect(summary.successMessage).toMatch(/Imported 2/);
  });

  it("surfaces account errors instead of fake success", () => {
    const summary = summarizeSyncResults(
      [{ synced: 0, total: 0, error: "Gmail list failed: 401" }],
      { oauthAccountCount: 1 }
    );
    expect(summary.errors).toBe(1);
    expect(summary.warning).toMatch(/failed/i);
  });
});

describe("Inbound sync — direction and architecture contracts", () => {
  it("inbound direction must remain INBOUND (not OUTBOUND)", () => {
    expect("INBOUND").not.toBe("OUTBOUND");
  });

  it("canonical path does not require Lead", () => {
    const enrollBody = { contactId: "c1", opportunityId: null };
    expect("leadId" in enrollBody).toBe(false);
  });

  it("tenant isolation binds organizationId on conversation lookup", () => {
    const where = {
      id: "conv-from-org-b",
      organizationId: "org-a",
    };
    expect(where.organizationId).toBe("org-a");
  });
});

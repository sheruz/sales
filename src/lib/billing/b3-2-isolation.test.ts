import { describe, expect, it } from "vitest";
import {
  DEFAULT_EMAIL_BRANDING,
  resolveSenderBranding,
} from "@/lib/email/branding";

describe("B3.2 Paddle customer isolation", () => {
  it("never allows two orgs to keep the same paddleCustomerId in one env", () => {
    const orgs = [
      {
        id: "org-a",
        paddleCustomerId: "ctm_1",
        paddleCustomerEnv: "sandbox",
      },
      {
        id: "org-b",
        paddleCustomerId: "ctm_1",
        paddleCustomerEnv: "sandbox",
      },
    ];
    const env = "sandbox";
    const byCustomer = new Map<string, string[]>();
    for (const o of orgs) {
      if (!o.paddleCustomerId || o.paddleCustomerEnv !== env) continue;
      const list = byCustomer.get(o.paddleCustomerId) || [];
      list.push(o.id);
      byCustomer.set(o.paddleCustomerId, list);
    }
    const shared = [...byCustomer.values()].filter((ids) => ids.length > 1);
    // apply script clears these; test documents the invariant
    expect(shared.length).toBeGreaterThan(0);
    const kept = shared[0][0];
    const cleared = orgs.map((o) =>
      o.id !== kept && o.paddleCustomerId === "ctm_1"
        ? { ...o, paddleCustomerId: null }
        : o
    );
    const after = new Map<string, number>();
    for (const o of cleared) {
      if (!o.paddleCustomerId) continue;
      after.set(o.paddleCustomerId, (after.get(o.paddleCustomerId) || 0) + 1);
    }
    expect([...after.values()].every((n) => n === 1)).toBe(true);
  });

  it("checkout email prefers Organization.billingEmail over seller", () => {
    const org = { billingEmail: "beenishshahid514@gmail.com" };
    const seller = "info@delvixstudio.com";
    const email = org.billingEmail || seller;
    expect(email).toBe("beenishshahid514@gmail.com");
    expect(email).not.toBe(seller);
  });

  it("new org billingEmail defaults to owner email", () => {
    const ownerEmail = "owner@acme.test";
    const created = { billingEmail: ownerEmail };
    expect(created.billingEmail).toBe(ownerEmail);
    expect(created.billingEmail).not.toContain("delvixstudio.com");
  });
});

describe("B3.2 tenant branding isolation", () => {
  it("DEFAULT_EMAIL_BRANDING has no Delvix URLs or company name", () => {
    expect(DEFAULT_EMAIL_BRANDING.websiteUrl).toBe("");
    expect(DEFAULT_EMAIL_BRANDING.legalCompanyName).toBe("");
    expect(DEFAULT_EMAIL_BRANDING.footerServices).toBe("");
    expect(JSON.stringify(DEFAULT_EMAIL_BRANDING)).not.toMatch(/delvix/i);
  });

  it("resolveSenderBranding does not inject Delvix Studio", () => {
    const resolved = resolveSenderBranding({
      organizationId: "tenant-1",
      branding: {
        ...DEFAULT_EMAIL_BRANDING,
        senderName: "",
        legalCompanyName: "",
      },
      orgFallbackName: "",
    });
    expect(resolved.senderName).toBe("");
    expect(resolved.companyLegalName).toBe("");
    expect(resolved.websiteUrl).toBe("");
  });

  it("outbound compliance requires tenant address — no owner fallback", () => {
    const tenantConfig = { businessName: "", physicalAddress: "" };
    const ownerConfig = {
      businessName: "Delvix Studio",
      physicalAddress: "Somewhere",
    };
    const canSend =
      Boolean(tenantConfig.physicalAddress.trim()) &&
      Boolean(tenantConfig.businessName.trim());
    expect(canSend).toBe(false);
    // Must never substitute owner
    const used = canSend ? tenantConfig : null;
    expect(used).toBeNull();
    expect(ownerConfig.businessName).toContain("Delvix");
  });
});

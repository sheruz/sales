import { describe, expect, it } from "vitest";
import {
  classifyEmailTraffic,
  isEmailSecurityBot,
  matchEmailSecurityUa,
} from "@/lib/security/email-bot-filter";

describe("email bot filter (PoW1 / Phase 4)", () => {
  it("flags Microsoft Safe Links / Defender / Mimecast / Proofpoint / Barracuda / Google image proxy", () => {
    const samples = [
      "Mozilla/5.0 (Windows NT 6.1; WOW64) SkypeUriPreview Advanced Microsoft Office Outlook 16",
      "Mozilla/5.0 SafeLinksProxy",
      "Mimecast URL Checker",
      "Proofpoint URL Defense",
      "Barracuda LinkProtect",
      "GoogleImageProxy",
    ];
    for (const ua of samples) {
      expect(matchEmailSecurityUa(ua)).toBeTruthy();
      expect(isEmailSecurityBot({ userAgent: ua })).toBe(true);
    }
  });

  it("treats empty UA as bot", () => {
    expect(classifyEmailTraffic({ userAgent: "" }).isBot).toBe(true);
    expect(classifyEmailTraffic({ userAgent: null }).category).toBe("known_bot");
  });

  it("flags datacenter IP within 60s of send", () => {
    const sentAt = new Date(Date.now() - 15_000);
    const r = classifyEmailTraffic({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
      ip: "52.94.76.10",
      sentAt,
    });
    expect(r.isBot).toBe(true);
    expect(r.category).toBe("datacenter_post_send");
  });

  it("allows human browser outside window", () => {
    const sentAt = new Date(Date.now() - 120_000);
    const r = classifyEmailTraffic({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
      ip: "52.94.76.10",
      sentAt,
    });
    expect(r.isBot).toBe(false);
    expect(r.category).toBe("human");
  });
});

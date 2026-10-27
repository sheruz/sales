import { describe, expect, it } from "vitest";
import { findBannedPhrases } from "@/lib/pow/banned-phrases";
import { pickUsableFindings } from "@/lib/pow/usable-findings";
import {
  findInventedNumbers,
  validatePowStep,
  countWords,
} from "@/lib/pow/validators";
import { assertPowSendAllowed, isPowSendEnabled } from "@/lib/pow/send-gate";
import { assertCaslPowEnroll } from "@/lib/pow/casl";

describe("PoW validators", () => {
  it("rejects invented numbers", () => {
    const invented = findInventedNumbers(
      "Your form fails for 47% of mobile visitors",
      "HTTP 500 on /quote"
    );
    expect(invented.some((n) => n.startsWith("47"))).toBe(true);
  });

  it("allows numbers present in evidence", () => {
    expect(
      findInventedNumbers(
        "Your quote form returned HTTP 500",
        "HTTP 500 at https://example.com/quote"
      )
    ).toEqual([]);
  });

  it("blocks banned phrases", () => {
    expect(findBannedPhrases("We were impressed by your site")).toContain(
      "we were impressed"
    );
    expect(findBannedPhrases("Hi there, quick note")).toContain("hi there");
  });

  it("no High A/B finding means empty usable list", () => {
    expect(
      pickUsableFindings([
        {
          id: "slow",
          severity: "B",
          title: "Slow",
          evidence: "LCP 5s",
          confidence: "Medium",
        },
        {
          id: "empty",
          severity: "C",
          title: "Empty",
          evidence: "n",
          confidence: "High",
        },
      ])
    ).toEqual([]);
    expect(
      pickUsableFindings([
        {
          id: "http_error",
          severity: "A",
          title: "Broken",
          evidence: "HTTP 500",
          confidence: "High",
        },
      ])
    ).toHaveLength(1);
  });

  it("enforces 60–100 word limit", () => {
    const short = "Hi Acme team. " + Array(10).fill("word").join(" ");
    const v = validatePowStep({
      step: { day: 3, subject: "quote form on acme.com", body: short },
      evidenceText: "HTTP 500",
      companyName: "Acme",
    });
    expect(v.wordCountOk).toBe(false);
    expect(countWords(short)).toBeLessThan(60);

    const body =
      "Hi Acme team. " +
      Array(70).fill("detail").join(" ") +
      " Want me to send the details?";
    const ok = validatePowStep({
      step: { day: 3, subject: "quote form on acme.com", body },
      evidenceText: "detail",
      companyName: "Acme",
    });
    expect(ok.wordCountOk).toBe(true);
  });
});

describe("PoW send gate + CASL", () => {
  it("executor refuses PoW sequences when flag off", () => {
    expect(isPowSendEnabled()).toBe(false);
    expect(() =>
      assertPowSendAllowed({ isProofOfWork: true, name: "Proof of Work" })
    ).toThrow(/cannot send/i);
    expect(() =>
      assertPowSendAllowed({ isProofOfWork: false, name: "Cold outreach" })
    ).not.toThrow();
  });

  it("CASL blocks Canadian without published source", () => {
    expect(() =>
      assertCaslPowEnroll({
        emailSource: "scraped",
        companyCountry: "Canada",
      })
    ).toThrow(/published/i);
    expect(() =>
      assertCaslPowEnroll({
        emailSource: "published",
        companyCountry: "Canada",
      })
    ).not.toThrow();
    expect(() =>
      assertCaslPowEnroll({
        emailSource: null,
        companyCountry: "United Arab Emirates",
      })
    ).not.toThrow();
  });
});

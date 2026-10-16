import { describe, expect, it } from "vitest";
import {
  buildMultipartAlternative,
  encodeRfc2047Header,
} from "@/services/email-provider.service";

describe("Gmail raw MIME encoding", () => {
  it("RFC 2047-encodes em dash in Subject (avoids Ã¢Â€Â” mojibake)", () => {
    const subject = "RSA Global — quick idea";
    const encoded = encodeRfc2047Header(subject);
    expect(encoded).toMatch(/^=\?UTF-8\?B\?/);
    expect(encoded).not.toContain("—");
    const b64 = encoded.match(/^=\?UTF-8\?B\?(.+)\?=$/)?.[1];
    expect(b64).toBeTruthy();
    expect(Buffer.from(b64!, "base64").toString("utf8")).toBe(subject);
  });

  it("leaves ASCII subjects untouched", () => {
    expect(encodeRfc2047Header("RSA Global - quick idea")).toBe(
      "RSA Global - quick idea"
    );
  });

  it("buildMultipartAlternative puts encoded Subject + base64 body for unicode", () => {
    const raw = buildMultipartAlternative({
      from: "Acme <a@example.com>",
      to: "b@example.com",
      subject: "RSA Global — quick idea",
      text: "Hello — world",
      html: "<p>Hello — world</p>",
    });
    expect(raw).toMatch(/^Subject: =\?UTF-8\?B\?/m);
    expect(raw).not.toMatch(/^Subject: .*—/m);
    expect(raw).toContain('charset="UTF-8"');
    expect(raw).toContain("Content-Transfer-Encoding: base64");
  });
});

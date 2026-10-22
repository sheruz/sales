import { describe, expect, it, vi, afterEach } from "vitest";
import {
  assertSafeOutboundUrl,
  assertSafeOutboundUrlResolved,
  isBlockedIpAddress,
  safeFetch,
} from "@/lib/security/ssrf";
import { ValidationError } from "@/lib/api/response";

describe("SSRF hardening (PoW1)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("blocks metadata IP and localhost (sync)", () => {
    expect(() =>
      assertSafeOutboundUrl("https://169.254.169.254/latest/meta-data/", {
        allowHttp: true,
      })
    ).toThrow(ValidationError);
    expect(() =>
      assertSafeOutboundUrl("http://127.0.0.1/", { allowHttp: true })
    ).toThrow(ValidationError);
    expect(() =>
      assertSafeOutboundUrl("http://localhost/admin", { allowHttp: true })
    ).toThrow(ValidationError);
    expect(() =>
      assertSafeOutboundUrl("https://10.0.0.5/", { allowHttp: true })
    ).toThrow(ValidationError);
    expect(() =>
      assertSafeOutboundUrl("https://192.168.1.1/", { allowHttp: true })
    ).toThrow(ValidationError);
    expect(() =>
      assertSafeOutboundUrl("https://172.16.0.1/", { allowHttp: true })
    ).toThrow(ValidationError);
  });

  it("blocks non-http(s) schemes", () => {
    expect(() =>
      assertSafeOutboundUrl("file:///etc/passwd", { allowHttp: true })
    ).toThrow(ValidationError);
    expect(() =>
      assertSafeOutboundUrl("ftp://example.com/", { allowHttp: true })
    ).toThrow(ValidationError);
  });

  it("isBlockedIpAddress covers link-local and ULA", () => {
    expect(isBlockedIpAddress("169.254.169.254")).toBe(true);
    expect(isBlockedIpAddress("::1")).toBe(true);
    expect(isBlockedIpAddress("fe80::1")).toBe(true);
    expect(isBlockedIpAddress("fd12::1")).toBe(true);
    expect(isBlockedIpAddress("8.8.8.8")).toBe(false);
  });

  it("connectors remain HTTPS-only by default", () => {
    expect(() => assertSafeOutboundUrl("http://example.com")).toThrow(
      ValidationError
    );
    expect(assertSafeOutboundUrl("https://api.hubapi.com/x").hostname).toBe(
      "api.hubapi.com"
    );
  });

  it("blocks DNS-rebinding style redirect to metadata", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("example.com")) {
        return new Response(null, {
          status: 302,
          headers: { Location: "http://169.254.169.254/latest/meta-data/" },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      safeFetch("https://example.com/start", {
        ssrf: { allowHttp: true },
        maxRedirects: 3,
      })
    ).rejects.toThrow(/blocked|Private|Outbound/i);
    // Second hop must never be fetched
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("assertSafeOutboundUrlResolved rejects metadata after lookup of literal", async () => {
    await expect(
      assertSafeOutboundUrlResolved("http://169.254.169.254/", {
        allowHttp: true,
      })
    ).rejects.toThrow(ValidationError);
    await expect(
      assertSafeOutboundUrlResolved("http://127.0.0.1/", { allowHttp: true })
    ).rejects.toThrow(ValidationError);
  });
});

/**
 * Basic DNS health for sending domains (SPF / DMARC TXT; DKIM selector probe).
 * Does not prove DKIM will pass for every provider — UI shows advisory status.
 */

import { promises as dns } from "dns";

export type DnsHealthResult = {
  domain: string;
  spf: { ok: boolean; record: string | null };
  dmarc: { ok: boolean; record: string | null };
  dkim: { ok: boolean; detail: string };
  checkedAt: string;
  canSend: boolean;
};

export async function checkSendingDomainDns(
  emailOrDomain: string
): Promise<DnsHealthResult> {
  const domain = emailOrDomain.includes("@")
    ? emailOrDomain.split("@")[1].toLowerCase()
    : emailOrDomain.toLowerCase().replace(/^www\./, "");

  let spfRecord: string | null = null;
  let dmarcRecord: string | null = null;

  try {
    const txts = await dns.resolveTxt(domain);
    const flat = txts.map((r) => r.join(""));
    spfRecord = flat.find((r) => /^v=spf1/i.test(r)) ?? null;
  } catch {
    spfRecord = null;
  }

  try {
    const txts = await dns.resolveTxt(`_dmarc.${domain}`);
    const flat = txts.map((r) => r.join(""));
    dmarcRecord = flat.find((r) => /v=DMARC1/i.test(r)) ?? null;
  } catch {
    dmarcRecord = null;
  }

  // Probe common DKIM selectors — presence of any is a soft OK
  const selectors = ["google", "selector1", "selector2", "default", "s1", "s2"];
  let dkimOk = false;
  let dkimDetail = "No common DKIM selector TXT found";
  for (const sel of selectors) {
    try {
      const txts = await dns.resolveTxt(`${sel}._domainkey.${domain}`);
      if (txts.length) {
        dkimOk = true;
        dkimDetail = `Found selector "${sel}"`;
        break;
      }
    } catch {
      /* try next */
    }
  }

  const spfOk = Boolean(spfRecord);
  const dmarcOk = Boolean(dmarcRecord);
  // Spec: block if missing SPF or DKIM
  const canSend = spfOk && dkimOk;

  return {
    domain,
    spf: { ok: spfOk, record: spfRecord },
    dmarc: { ok: dmarcOk, record: dmarcRecord },
    dkim: { ok: dkimOk, detail: dkimDetail },
    checkedAt: new Date().toISOString(),
    canSend,
  };
}

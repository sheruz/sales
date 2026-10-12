/**
 * Basic DNS health for sending domains (SPF / DMARC TXT; DKIM selector probe).
 *
 * Custom domains: require SPF + public DKIM selector (block send if missing).
 * Provider-managed mailboxes (Gmail/Outlook/Yahoo personal): operator cannot
 * publish DKIM on the ESP domain — treat as OK when SPF is present (provider signs).
 */

import { promises as dns } from "dns";

export type DnsHealthResult = {
  domain: string;
  spf: { ok: boolean; record: string | null };
  dmarc: { ok: boolean; record: string | null };
  dkim: { ok: boolean; detail: string };
  /** True when domain DNS is managed by Gmail/Microsoft/Yahoo (not your custom domain) */
  providerManaged: boolean;
  checkedAt: string;
  canSend: boolean;
};

/** Domains where the mailbox provider owns DKIM — you cannot set DNS yourself. */
const PROVIDER_MANAGED_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "ymail.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
]);

export function isProviderManagedDomain(domain: string): boolean {
  return PROVIDER_MANAGED_DOMAINS.has(domain.toLowerCase());
}

export async function checkSendingDomainDns(
  emailOrDomain: string
): Promise<DnsHealthResult> {
  const domain = emailOrDomain.includes("@")
    ? emailOrDomain.split("@")[1].toLowerCase()
    : emailOrDomain.toLowerCase().replace(/^www\./, "");

  const providerManaged = isProviderManagedDomain(domain);

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

  const selectors = [
    "google",
    "selector1",
    "selector2",
    "default",
    "s1",
    "s2",
    "k1",
    "mail",
    "dkim",
  ];
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

  if (providerManaged && !dkimOk) {
    // Gmail/Outlook/etc. sign outbound mail; public selector probe is unreliable
    dkimOk = true;
    dkimDetail =
      "Provider-managed domain (Gmail/Outlook/etc.) — DKIM signed by provider";
  }

  const spfOk = Boolean(spfRecord);
  // Custom domains: require SPF + DKIM.
  // Provider mailboxes (gmail.com etc.): allow — ESP owns SPF/DKIM; operator can't fix DNS.
  const canSend = providerManaged ? true : spfOk && dkimOk;

  return {
    domain,
    spf: { ok: spfOk || providerManaged, record: spfRecord },
    dmarc: { ok: Boolean(dmarcRecord), record: dmarcRecord },
    dkim: { ok: dkimOk, detail: dkimDetail },
    providerManaged,
    checkedAt: new Date().toISOString(),
    canSend,
  };
}

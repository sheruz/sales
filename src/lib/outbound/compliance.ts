/**
 * Compliance wrappers for outbound plain-text emails.
 */

export type ComplianceFooterInput = {
  businessName: string;
  physicalAddress: string;
  unsubscribeUrl: string;
};

export function appendComplianceFooter(
  body: string,
  input: ComplianceFooterInput
): string {
  const lines = [
    body.trimEnd(),
    "",
    "---",
    `To unsubscribe: ${input.unsubscribeUrl}`,
    `${input.businessName}`,
    input.physicalAddress,
  ];
  return lines.join("\n");
}

export function buildListUnsubscribeHeaders(input: {
  unsubscribeUrl: string;
  mailtoEmail?: string | null;
}): Record<string, string> {
  const parts = [`<${input.unsubscribeUrl}>`];
  if (input.mailtoEmail) {
    parts.push(`<mailto:${input.mailtoEmail}?subject=unsubscribe>`);
  }
  return {
    "List-Unsubscribe": parts.join(", "),
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** Count http(s) links in plain text — step 1 may have at most one. */
export function countHttpLinks(text: string): number {
  const matches = text.match(/https?:\/\/[^\s)]+/gi);
  return matches?.length ?? 0;
}

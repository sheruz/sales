/**
 * PoW2: only Severity A or B + High confidence findings may drive emails.
 */

export type UsableFinding = {
  id: string;
  severity: "A" | "B" | "C";
  title: string;
  whyItMatters?: string;
  evidence: string;
  confidence: string;
  emailEligible?: boolean;
  viewport?: string | null;
};

export function pickUsableFindings(
  findings: UsableFinding[]
): UsableFinding[] {
  return findings.filter((f) => {
    if (f.severity !== "A" && f.severity !== "B") return false;
    if (String(f.confidence).toLowerCase() !== "high") return false;
    if (f.emailEligible === false) return false;
    return true;
  });
}

export function extractFindingsFromAuditJson(
  findingsJson: unknown
): UsableFinding[] {
  if (!findingsJson || typeof findingsJson !== "object") return [];
  const raw = findingsJson as Record<string, unknown>;
  const list = Array.isArray(raw.findings) ? raw.findings : [];
  return list
    .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
    .map((f) => ({
      id: String(f.id ?? ""),
      severity: (String(f.severity ?? "C") as "A" | "B" | "C"),
      title: String(f.title ?? ""),
      whyItMatters: f.whyItMatters ? String(f.whyItMatters) : undefined,
      evidence: String(f.evidence ?? ""),
      confidence: String(f.confidence ?? "Low"),
      emailEligible:
        typeof f.emailEligible === "boolean" ? f.emailEligible : undefined,
      viewport: f.viewport ? String(f.viewport) : null,
    }));
}

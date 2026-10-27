export type DeepFindingSeverity = "A" | "B" | "C";
export type DeepFindingConfidence = "High" | "Medium" | "Low";

export type DeepFinding = {
  id: string;
  severity: DeepFindingSeverity;
  /** Plain-language title for property managers */
  title: string;
  /** One line: why a prospect should care */
  whyItMatters: string;
  evidence: string;
  confidence: DeepFindingConfidence;
  /** Never fabricate — only what we observed */
  observed: true;
  viewport?: "desktop" | "mobile" | "both";
  /** Finding may be used in outreach email only when High */
  emailEligible: boolean;
};

export type DeepAuditBrowserResult = {
  ok: boolean;
  finalUrl: string | null;
  title: string | null;
  findings: DeepFinding[];
  screenshots: {
    desktop?: Buffer;
    mobile?: Buffer;
  };
  metrics: {
    /** Supporting evidence only — never headline speed numbers */
    desktopLoadMs?: number;
    mobileLoadMs?: number;
    consoleErrors: number;
    brokenImages: number;
    brokenImageUrls: string[];
    hasViewportMeta: boolean;
    hasHttps: boolean;
    formCount: boolean;
    /** Forms were never submitted (policy) */
    formSubmitAttempted: false;
    consentBannerVisible?: boolean;
    sslExpiresInDays?: number | null;
  };
  error?: string;
};

export const DEEP_AUDIT_SITE_TIMEOUT_MS = 60_000;
export const DEEP_AUDIT_MAX_CONCURRENT = 2;
export const ALLOW_FORM_TEST_SUBMISSION = false;

/** Google “poor” LCP threshold (lab/field), ms */
export const PSI_LCP_POOR_MS = 4_000;
/** Flag speed finding when PSI performance score is below this */
export const PSI_SCORE_POOR = 50;

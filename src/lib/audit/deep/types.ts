export type DeepFindingSeverity = "A" | "B" | "C";

export type DeepFinding = {
  id: string;
  severity: DeepFindingSeverity;
  title: string;
  evidence: string;
  /** Never fabricate — only what we observed */
  observed: true;
  viewport?: "desktop" | "mobile" | "both";
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
    desktopLoadMs?: number;
    mobileLoadMs?: number;
    consoleErrors: number;
    brokenImages: number;
    hasViewportMeta: boolean;
    hasHttps: boolean;
    formCount: boolean;
    /** Forms were never submitted (policy) */
    formSubmitAttempted: false;
  };
  error?: string;
};

export const DEEP_AUDIT_SITE_TIMEOUT_MS = 60_000;
export const DEEP_AUDIT_MAX_CONCURRENT = 2;
export const ALLOW_FORM_TEST_SUBMISSION = false;

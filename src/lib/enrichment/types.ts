export type EmailVerificationStatus =
  | "valid"
  | "accept_all"
  | "invalid"
  | "unknown";

export type EnrichmentPerson = {
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  email: string;
  title: string | null;
  seniority: string | null;
  linkedInUrl: string | null;
  confidence: number | null;
};

export type DomainSearchResult = {
  domain: string;
  people: EnrichmentPerson[];
  raw?: unknown;
};

export type VerifyEmailResult = {
  email: string;
  status: EmailVerificationStatus;
  score: number | null;
  raw?: unknown;
};

export type AccountCredits = {
  available: number | null;
  used: number | null;
  raw?: unknown;
};

export interface EnrichmentProvider {
  readonly name: string;
  domainSearch(domain: string): Promise<DomainSearchResult>;
  verifyEmail(email: string): Promise<VerifyEmailResult>;
  getCredits(): Promise<AccountCredits>;
}

export class EnrichmentRateLimitError extends Error {
  constructor(message = "Enrichment rate limited (429)") {
    super(message);
    this.name = "EnrichmentRateLimitError";
  }
}

export class EnrichmentApiError extends Error {
  status: number;
  retryable: boolean;
  constructor(message: string, status: number, retryable = true) {
    super(message);
    this.name = "EnrichmentApiError";
    this.status = status;
    this.retryable = retryable;
  }
}

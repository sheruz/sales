import { createHash } from "crypto";
import type { SignalType, SourceConnectorType } from "@prisma/client";

/** Provider-agnostic normalized signal — Opportunity Engine only consumes this shape. */
export interface NormalizedCompany {
  name: string;
  domain?: string | null;
  website?: string | null;
  industry?: string | null;
  country?: string | null;
  city?: string | null;
  description?: string | null;
  technologies?: string[];
}

export interface NormalizedContact {
  firstName: string;
  lastName: string;
  email?: string | null;
  title?: string | null;
  phone?: string | null;
  linkedInUrl?: string | null;
  department?: string | null;
  seniority?: string | null;
}

export interface NormalizedSignalRecord {
  signalType: SignalType;
  title: string;
  description?: string | null;
  evidenceUrl?: string | null;
  evidenceText?: string | null;
  confidence: number;
  occurredAt?: Date | string | null;
  externalId?: string | null;
  /** If omitted, computed via buildSignalFingerprint */
  fingerprint?: string;
  company: NormalizedCompany;
  contact?: NormalizedContact | null;
  whyNow?: string | null;
  likelyProblem?: string | null;
  recommendedAction?: string | null;
  estimatedValue?: number | null;
  budgetHint?: string | null;
  leadScore?: number | null;
  /** Opaque provider payload (job URL, investors, CSV row, etc.) */
  rawData?: Record<string, unknown> | null;
}

export interface ConnectorFetchContext {
  organizationId: string;
  userId: string;
  connectorId: string;
  configuration: Record<string, unknown>;
  credentials: Record<string, string>;
  /** Optional run hints (campaign, count, CSV rows, etc.) */
  params?: Record<string, unknown>;
}

export interface ConnectorFetchResult {
  rawRecords: unknown[];
  metadata?: Record<string, unknown>;
}

export interface SourceConnectorAdapter {
  type: SourceConnectorType;
  /** Default provider key for this adapter implementation */
  provider: string;
  displayName: string;
  description: string;

  connect?(ctx: ConnectorFetchContext): Promise<void>;
  disconnect?(ctx: ConnectorFetchContext): Promise<void>;
  validate(ctx: ConnectorFetchContext): Promise<{ ok: boolean; message?: string }>;
  fetch(ctx: ConnectorFetchContext): Promise<ConnectorFetchResult>;
  normalize(raw: unknown, ctx: ConnectorFetchContext): NormalizedSignalRecord | null;
}

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|co|gmbh|plc|limited|incorporated)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function buildSignalFingerprint(input: {
  organizationId: string;
  signalType: string;
  companyName: string;
  domain?: string | null;
  title: string;
  evidenceUrl?: string | null;
  externalId?: string | null;
}): string {
  const basis = [
    input.organizationId,
    input.signalType,
    input.externalId || "",
    input.domain || normalizeCompanyName(input.companyName),
    input.title.trim().toLowerCase(),
    (input.evidenceUrl || "").trim().toLowerCase(),
  ].join("|");

  return createHash("sha256").update(basis).digest("hex");
}

export function ensureFingerprint(
  record: NormalizedSignalRecord,
  organizationId: string
): string {
  if (record.fingerprint) return record.fingerprint;
  return buildSignalFingerprint({
    organizationId,
    signalType: record.signalType,
    companyName: record.company.name,
    domain: record.company.domain,
    title: record.title,
    evidenceUrl: record.evidenceUrl,
    externalId: record.externalId,
  });
}

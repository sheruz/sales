import prisma from "@/lib/db/prisma";
import { extractDomain } from "@/services/company.service";
import {
  ensureFingerprint,
  normalizeCompanyName,
  type NormalizedSignalRecord,
} from "@/lib/connectors/types";

export type DedupeDecision =
  | { action: "create" }
  | { action: "skip"; reason: string; existingSignalId?: string }
  | { action: "update"; existingSignalId: string };

/**
 * Deduplicate by org + fingerprint, external ID, company domain/name, contact email.
 */
export async function resolveSignalDedupe(
  organizationId: string,
  record: NormalizedSignalRecord,
  sourceConnectorId?: string | null
): Promise<DedupeDecision> {
  const fingerprint = ensureFingerprint(record, organizationId);

  const byFingerprint = await prisma.signal.findFirst({
    where: { organizationId, fingerprint },
    select: { id: true },
  });
  if (byFingerprint) {
    return {
      action: "skip",
      reason: "duplicate_fingerprint",
      existingSignalId: byFingerprint.id,
    };
  }

  if (record.externalId && sourceConnectorId) {
    const byExternal = await prisma.signal.findFirst({
      where: {
        organizationId,
        sourceConnectorId,
        externalId: record.externalId,
      },
      select: { id: true },
    });
    if (byExternal) {
      return {
        action: "update",
        existingSignalId: byExternal.id,
      };
    }
  }

  // Soft company-level duplicate of identical title within 7 days
  const domain =
    record.company.domain || extractDomain(record.company.website) || null;
  const normalizedName = normalizeCompanyName(record.company.name);
  const company = await prisma.company.findFirst({
    where: {
      organizationId,
      deletedAt: null,
      OR: [
        ...(domain ? [{ domain }] : []),
        { name: { equals: record.company.name, mode: "insensitive" as const } },
      ],
    },
    select: { id: true, name: true },
  });

  if (company && normalizeCompanyName(company.name) === normalizedName) {
    const recent = await prisma.signal.findFirst({
      where: {
        organizationId,
        companyId: company.id,
        type: record.signalType,
        title: { equals: record.title, mode: "insensitive" },
        detectedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      select: { id: true },
    });
    if (recent) {
      return {
        action: "skip",
        reason: "recent_same_title_company",
        existingSignalId: recent.id,
      };
    }
  }

  if (record.contact?.email) {
    const email = record.contact.email.toLowerCase();
    const contactDup = await prisma.contact.findFirst({
      where: { organizationId, email },
      select: { id: true, companyId: true },
    });
    if (contactDup) {
      const sameSignal = await prisma.signal.findFirst({
        where: {
          organizationId,
          companyId: contactDup.companyId,
          type: record.signalType,
          title: { equals: record.title, mode: "insensitive" },
          detectedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        select: { id: true },
      });
      if (sameSignal) {
        return {
          action: "skip",
          reason: "contact_email_recent_signal",
          existingSignalId: sameSignal.id,
        };
      }
    }
  }

  return { action: "create" };
}

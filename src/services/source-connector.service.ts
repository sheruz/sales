import prisma from "@/lib/db/prisma";
import {
  SourceConnectorStatus,
  SourceConnectorType,
  SourceRunStatus,
  type Prisma,
} from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/response";
import {
  encryptCredentials,
  decryptCredentials,
} from "@/lib/integrations/credentials";
import { getConnectorAdapter, catalogConnectorTypes } from "@/lib/connectors/registry";
import { opportunityService } from "@/services/opportunity.service";
import { entitlementService } from "@/services/entitlement.service";
import { FEATURE_KEYS } from "@/lib/billing/features";

function sourceKeyForType(type: SourceConnectorType): { key: string; name: string } {
  switch (type) {
    case SourceConnectorType.HIRING:
      return { key: "hiring", name: "Hiring signals" };
    case SourceConnectorType.FUNDING:
      return { key: "funding", name: "Funding signals" };
    case SourceConnectorType.WEB_RESEARCH:
      return { key: "web_research", name: "Web research" };
    case SourceConnectorType.RFP_TENDER:
      return { key: "rfp_tender", name: "RFP / Tender" };
    case SourceConnectorType.CSV_CRM:
      return { key: "csv_crm", name: "CSV / CRM import" };
    default:
      return { key: "custom", name: "Custom source" };
  }
}

export class SourceConnectorService {
  catalog() {
    return catalogConnectorTypes();
  }

  async list(organizationId: string) {
    return prisma.sourceConnector.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        name: true,
        provider: true,
        status: true,
        configuration: true,
        lastSyncAt: true,
        lastError: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { runs: true } },
      },
    });
  }

  async getById(organizationId: string, id: string) {
    const row = await prisma.sourceConnector.findFirst({
      where: { id, organizationId },
      include: {
        runs: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
    if (!row) throw new NotFoundError("Source connector not found");
    const { credentialsEncrypted: _, ...safe } = row;
    return safe;
  }

  async create(
    organizationId: string,
    input: {
      type: SourceConnectorType;
      name: string;
      provider?: string;
      configuration?: Record<string, unknown>;
      credentials?: Record<string, string>;
    }
  ) {
    const adapter = getConnectorAdapter(input.type, input.provider);
    if (!adapter) throw new ValidationError("Unknown connector type");

    await entitlementService.assertSeatAvailable(
      organizationId,
      FEATURE_KEYS.CONNECTORS
    );

    return prisma.sourceConnector.create({
      data: {
        organizationId,
        type: input.type,
        name: input.name.trim(),
        provider: input.provider || adapter.provider,
        status: SourceConnectorStatus.CONNECTED,
        configuration: (input.configuration ?? {}) as Prisma.InputJsonValue,
        credentialsEncrypted: input.credentials
          ? encryptCredentials(input.credentials)
          : null,
      },
    });
  }

  async update(
    organizationId: string,
    id: string,
    input: Partial<{
      name: string;
      status: SourceConnectorStatus;
      configuration: Record<string, unknown>;
      credentials: Record<string, string> | null;
    }>
  ) {
    await this.getById(organizationId, id);
    return prisma.sourceConnector.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        status: input.status,
        configuration: input.configuration as Prisma.InputJsonValue | undefined,
        credentialsEncrypted:
          input.credentials === undefined
            ? undefined
            : input.credentials
              ? encryptCredentials(input.credentials)
              : null,
      },
    });
  }

  async ensureDefaultHiringConnector(organizationId: string) {
    const existing = await prisma.sourceConnector.findFirst({
      where: {
        organizationId,
        type: SourceConnectorType.HIRING,
        provider: "ai_job_discovery",
      },
    });
    if (existing) return existing;
    return this.create(organizationId, {
      type: SourceConnectorType.HIRING,
      name: "Hiring Signal Connector",
      provider: "ai_job_discovery",
      configuration: { complianceNote: "Uses AI discovery; not a scraped board" },
    });
  }

  /**
   * Run connector: validate → fetch → normalize → dedupe → create signals/opportunities.
   */
  async run(
    organizationId: string,
    connectorId: string,
    userId: string,
    params?: Record<string, unknown>
  ) {
    const connector = await prisma.sourceConnector.findFirst({
      where: { id: connectorId, organizationId },
    });
    if (!connector) throw new NotFoundError("Source connector not found");
    if (connector.status === SourceConnectorStatus.DISABLED) {
      throw new ValidationError("Connector is disabled");
    }

    await entitlementService.assertAndConsume(
      organizationId,
      FEATURE_KEYS.SOURCES
    );

    const adapter = getConnectorAdapter(connector.type, connector.provider);
    if (!adapter) throw new ValidationError("No adapter for connector");

    const credentials = connector.credentialsEncrypted
      ? decryptCredentials(connector.credentialsEncrypted)
      : {};
    const configuration =
      (connector.configuration as Record<string, unknown>) || {};

    const ctx = {
      organizationId,
      userId,
      connectorId: connector.id,
      configuration,
      credentials,
      params,
    };

    const validation = await adapter.validate(ctx);
    if (!validation.ok) {
      await prisma.sourceConnector.update({
        where: { id: connector.id },
        data: {
          status: SourceConnectorStatus.ERROR,
          lastError: validation.message || "Validation failed",
        },
      });
      throw new ValidationError(validation.message || "Connector validation failed");
    }

    const run = await prisma.sourceRun.create({
      data: {
        organizationId,
        sourceConnectorId: connector.id,
        status: SourceRunStatus.RUNNING,
        startedAt: new Date(),
        metadata: params as Prisma.InputJsonValue | undefined,
      },
    });

    const { key: sourceKey, name: sourceName } = sourceKeyForType(connector.type);
    let found = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    let skipped = 0;
    const opportunityIds: string[] = [];
    const errors: string[] = [];

    try {
      const fetched = await adapter.fetch(ctx);
      found = fetched.rawRecords.length;

      for (const raw of fetched.rawRecords) {
        try {
          const normalized = adapter.normalize(raw, ctx);
          if (!normalized) {
            skipped++;
            continue;
          }

          const result = await opportunityService.ingestNormalizedSignal({
            organizationId,
            userId,
            record: normalized,
            sourceKey,
            sourceName,
            sourceConnectorId: connector.id,
            sourceRunId: run.id,
            campaignId: (params?.campaignId as string) || null,
            leadId: null,
          });

          if (result.skipped) {
            skipped++;
            if (result.existingSignalId) updated++;
          } else {
            created++;
            if (result.opportunityId) opportunityIds.push(result.opportunityId);
          }
        } catch (err) {
          failed++;
          errors.push(err instanceof Error ? err.message : "record failed");
        }
      }

      await prisma.sourceRun.update({
        where: { id: run.id },
        data: {
          status: SourceRunStatus.COMPLETED,
          completedAt: new Date(),
          recordsFound: found,
          recordsCreated: created,
          recordsUpdated: updated,
          recordsFailed: failed,
          recordsSkipped: skipped,
          metadata: {
            ...(fetched.metadata || {}),
            opportunityIds,
            errors: errors.slice(0, 20),
          } as Prisma.InputJsonValue,
        },
      });

      await prisma.sourceConnector.update({
        where: { id: connector.id },
        data: {
          status: SourceConnectorStatus.CONNECTED,
          lastSyncAt: new Date(),
          lastError: null,
        },
      });

      return {
        runId: run.id,
        found,
        created,
        updated,
        failed,
        skipped,
        opportunityIds,
        errors,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Run failed";
      await prisma.sourceRun.update({
        where: { id: run.id },
        data: {
          status: SourceRunStatus.FAILED,
          completedAt: new Date(),
          recordsFound: found,
          recordsCreated: created,
          recordsUpdated: updated,
          recordsFailed: failed,
          recordsSkipped: skipped,
          error: message,
        },
      });
      await prisma.sourceConnector.update({
        where: { id: connector.id },
        data: {
          status: SourceConnectorStatus.ERROR,
          lastError: message,
        },
      });
      throw err;
    }
  }

  async listRuns(organizationId: string, connectorId?: string) {
    return prisma.sourceRun.findMany({
      where: {
        organizationId,
        ...(connectorId ? { sourceConnectorId: connectorId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        sourceConnector: { select: { id: true, name: true, type: true } },
      },
    });
  }
}

export const sourceConnectorService = new SourceConnectorService();

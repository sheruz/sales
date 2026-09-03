import prisma from "@/lib/db/prisma";
import {
  ActivityType,
  AutomationStatus,
  LeadScoreCategory,
  LeadStatus,
  SourceRunStatus,
} from "@prisma/client";
import { activityService } from "@/services/activity.service";
import { companyService } from "@/services/company.service";
import { opportunityService } from "@/services/opportunity.service";
import { sourceConnectorService } from "@/services/source-connector.service";
import { hiringSignalConnector } from "@/lib/connectors/adapters/hiring";
import type { Prisma } from "@prisma/client";

function mapScoreCategory(category: string): LeadScoreCategory {
  const map: Record<string, LeadScoreCategory> = {
    HOT: LeadScoreCategory.HOT,
    WARM: LeadScoreCategory.WARM,
    POSSIBLE: LeadScoreCategory.POSSIBLE,
    LOW_PRIORITY: LeadScoreCategory.LOW_PRIORITY,
  };
  return map[category] ?? LeadScoreCategory.POSSIBLE;
}

/**
 * Job discovery is now a thin orchestrator over the Hiring Signal Connector.
 * The Opportunity Engine only sees NormalizedSignalRecord — not job boards.
 */
export class JobDiscoveryService {
  async discoverFromJobPosts(
    organizationId: string,
    criteria: {
      jobTitles?: string[];
      industries?: string[];
      countries?: string[];
      description?: string;
    },
    count: number,
    campaignId: string,
    userId: string,
    campaignContext?: string | null
  ) {
    const connector =
      await sourceConnectorService.ensureDefaultHiringConnector(organizationId);

    const run = await prisma.sourceRun.create({
      data: {
        organizationId,
        sourceConnectorId: connector.id,
        status: SourceRunStatus.RUNNING,
        startedAt: new Date(),
        metadata: { campaignId, count, via: "job_discovery" },
      },
    });

    const ctx = {
      organizationId,
      userId,
      connectorId: connector.id,
      configuration: (connector.configuration as Record<string, unknown>) || {},
      credentials: {},
      params: {
        count,
        criteria,
        campaignContext: campaignContext ?? undefined,
        campaignId,
      },
    };

    const leadIds: string[] = [];
    const opportunityIds: string[] = [];
    const errors: string[] = [];
    let skippedNoEmail = 0;
    let created = 0;
    let skipped = 0;
    let failed = 0;

    try {
      const validation = await hiringSignalConnector.validate(ctx);
      if (!validation.ok) {
        throw new Error(validation.message || "Hiring connector validation failed");
      }

      const fetched = await hiringSignalConnector.fetch(ctx);
      const prospectsFound = fetched.rawRecords.length;

      for (const raw of fetched.rawRecords) {
        if (leadIds.length >= count) break;

        const normalized = hiringSignalConnector.normalize(raw, ctx);
        if (!normalized) {
          skipped++;
          continue;
        }

        const email = normalized.contact?.email;
        if (!email?.includes("@")) {
          skippedNoEmail++;
          // Still ingest signal/opportunity without lead bridge
          try {
            const result = await opportunityService.ingestNormalizedSignal({
              organizationId,
              userId,
              record: normalized,
              sourceKey: "hiring",
              sourceName: "Hiring signals",
              sourceConnectorId: connector.id,
              sourceRunId: run.id,
              campaignId,
            });
            if (result.skipped) skipped++;
            else {
              created++;
              if (result.opportunityId) opportunityIds.push(result.opportunityId);
            }
          } catch (err) {
            failed++;
            errors.push(err instanceof Error ? err.message : "failed");
          }
          continue;
        }

        try {
          const existing = await prisma.lead.findFirst({
            where: {
              organizationId,
              deletedAt: null,
              OR: [
                { email: email.toLowerCase() },
                {
                  companyName: normalized.company.name,
                  fullName: `${normalized.contact!.firstName} ${normalized.contact!.lastName}`,
                },
              ],
            },
          });
          if (existing) {
            skipped++;
            continue;
          }

          const company = await companyService.findOrCreate(
            organizationId,
            normalized.company.name,
            {
              website: normalized.company.website ?? undefined,
              industry: normalized.company.industry ?? undefined,
              country: normalized.company.country ?? undefined,
              description: normalized.company.description ?? undefined,
              source: "hiring",
            }
          );

          const rawJob = (normalized.rawData as { job?: Record<string, unknown>; scoreCategory?: string }) || {};
          const scoreCategory = mapScoreCategory(
            String(rawJob.scoreCategory || "POSSIBLE")
          );
          const leadScore = normalized.leadScore ?? normalized.confidence;

          const lead = await prisma.lead.create({
            data: {
              organizationId,
              firstName: normalized.contact!.firstName,
              lastName: normalized.contact!.lastName,
              fullName: `${normalized.contact!.firstName} ${normalized.contact!.lastName}`,
              email: email.toLowerCase(),
              jobTitle: normalized.contact!.title,
              companyName: normalized.company.name,
              companyWebsite: normalized.company.website,
              industry: normalized.company.industry,
              country: normalized.company.country,
              companyDescription: normalized.company.description,
              companyId: company.id,
              source: "Hiring Signal",
              campaignId,
              createdById: userId,
              score: leadScore,
              scoreCategory,
              status: LeadStatus.QUALIFIED,
              automationStatus: AutomationStatus.IDLE,
              automationMeta: {
                connector: {
                  type: "HIRING",
                  provider: hiringSignalConnector.provider,
                  runId: run.id,
                },
                jobPost: rawJob.job ?? null,
                preResearched: true,
                opportunityEngine: true,
              } as Prisma.InputJsonValue,
              notes: `Hiring signal: ${normalized.title}`,
            },
          });

          if (campaignId) {
            await prisma.campaignLead.create({
              data: { campaignId, leadId: lead.id },
            });
          }

          const result = await opportunityService.ingestNormalizedSignal({
            organizationId,
            userId,
            record: normalized,
            sourceKey: "hiring",
            sourceName: "Hiring signals",
            sourceConnectorId: connector.id,
            sourceRunId: run.id,
            campaignId,
            leadId: lead.id,
          });

          leadIds.push(lead.id);
          if (result.opportunityId) opportunityIds.push(result.opportunityId);
          if (result.skipped) skipped++;
          else created++;

          await activityService.log({
            leadId: lead.id,
            userId,
            type: ActivityType.LEAD_CREATED,
            title: "Hiring connector → signal → opportunity",
            description: `${normalized.title} at ${normalized.company.name}`,
          });
        } catch (err) {
          failed++;
          errors.push(
            `${normalized.company.name}: ${err instanceof Error ? err.message : "failed"}`
          );
        }
      }

      await prisma.sourceRun.update({
        where: { id: run.id },
        data: {
          status: SourceRunStatus.COMPLETED,
          completedAt: new Date(),
          recordsFound: prospectsFound,
          recordsCreated: created,
          recordsFailed: failed,
          recordsSkipped: skipped + skippedNoEmail,
          metadata: {
            leadIds,
            opportunityIds,
            errors: errors.slice(0, 20),
          } as Prisma.InputJsonValue,
        },
      });

      await prisma.sourceConnector.update({
        where: { id: connector.id },
        data: { lastSyncAt: new Date(), lastError: null, status: "CONNECTED" },
      });

      return {
        leadIds,
        opportunityIds,
        errors,
        prospectsFound,
        skippedNoEmail,
        runId: run.id,
        connectorId: connector.id,
      };
    } catch (err) {
      await prisma.sourceRun.update({
        where: { id: run.id },
        data: {
          status: SourceRunStatus.FAILED,
          completedAt: new Date(),
          error: err instanceof Error ? err.message : "failed",
        },
      });
      throw err;
    }
  }
}

export const jobDiscoveryService = new JobDiscoveryService();

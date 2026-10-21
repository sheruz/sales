/**
 * B5c: org-scoped ZIP of CSVs (background job, 24h download token).
 */

import { randomBytes } from "crypto";
import { mkdir, writeFile, unlink } from "fs/promises";
import { join } from "path";
import prisma from "@/lib/db/prisma";
import { DataExportStatus } from "@prisma/client";
import { logger } from "@/lib/logger";
import { createZipStore, toCsv } from "@/lib/export/zip-store";
import { writeAuditLog } from "@/lib/security/audit";
import { ValidationError, NotFoundError, ForbiddenError } from "@/lib/api/response";

const TTL_MS = 24 * 60 * 60 * 1000;
const ROW_CAP = 20_000;

function exportRootDir(): string {
  const custom = process.env.DATA_EXPORT_DIR?.trim();
  if (custom) return custom;
  return join(process.cwd(), "storage", "exports");
}

function flattenRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Date) out[k] = v.toISOString();
    else if (typeof v === "bigint") out[k] = v.toString();
    else if (v != null && typeof v === "object") out[k] = JSON.stringify(v);
    else out[k] = v;
  }
  return out;
}

export class PrivacyExportService {
  async createJob(input: {
    organizationId: string;
    userId: string;
  }) {
    // Expire old ready jobs for org (optional cleanup)
    await prisma.dataExportJob.updateMany({
      where: {
        organizationId: input.organizationId,
        status: DataExportStatus.READY,
        expiresAt: { lt: new Date() },
      },
      data: { status: DataExportStatus.EXPIRED },
    });

    const token = randomBytes(24).toString("hex");
    const job = await prisma.dataExportJob.create({
      data: {
        organizationId: input.organizationId,
        requestedByUserId: input.userId,
        status: DataExportStatus.PENDING,
        downloadToken: token,
      },
    });

    await writeAuditLog({
      organizationId: input.organizationId,
      userId: input.userId,
      action: "privacy.data_export_job",
      entityType: "data_export_job",
      entityId: job.id,
      newValues: { status: "PENDING" },
    });

    // Process inline (await) — keeps UX simple; large orgs still capped
    void this.processJob(job.id).catch((err) => {
      logger.error("data export job failed", {
        jobId: job.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    return job;
  }

  async processJob(jobId: string) {
    const job = await prisma.dataExportJob.findUnique({ where: { id: jobId } });
    if (!job) return;
    if (
      job.status !== DataExportStatus.PENDING &&
      job.status !== DataExportStatus.PROCESSING
    ) {
      return;
    }

    await prisma.dataExportJob.update({
      where: { id: jobId },
      data: {
        status: DataExportStatus.PROCESSING,
        startedAt: new Date(),
      },
    });

    try {
      const orgId = job.organizationId;
      const [
        companies,
        contacts,
        opportunities,
        conversations,
        messages,
        campaigns,
        invoices,
      ] = await Promise.all([
        prisma.company.findMany({
          where: { organizationId: orgId },
          take: ROW_CAP,
        }),
        prisma.contact.findMany({
          where: { organizationId: orgId },
          take: ROW_CAP,
        }),
        prisma.opportunity.findMany({
          where: { organizationId: orgId },
          take: ROW_CAP,
        }),
        prisma.inboxConversation.findMany({
          where: { organizationId: orgId },
          take: ROW_CAP,
        }),
        prisma.message.findMany({
          where: { organizationId: orgId },
          take: ROW_CAP,
          select: {
            id: true,
            organizationId: true,
            conversationId: true,
            direction: true,
            subject: true,
            body: true,
            fromEmail: true,
            toEmail: true,
            status: true,
            sentAt: true,
            receivedAt: true,
            createdAt: true,
          },
        }),
        prisma.campaign.findMany({
          where: { organizationId: orgId, deletedAt: null },
          take: ROW_CAP,
        }),
        prisma.invoice.findMany({
          where: { organizationId: orgId },
          take: ROW_CAP,
        }),
      ]);

      // Isolation guard — every row must belong to org
      const assertOrg = (rows: { organizationId: string }[], label: string) => {
        for (const r of rows) {
          if (r.organizationId !== orgId) {
            throw new Error(`Isolation breach in ${label}`);
          }
        }
      };
      assertOrg(companies, "companies");
      assertOrg(contacts, "contacts");
      assertOrg(opportunities, "opportunities");
      assertOrg(conversations, "conversations");
      assertOrg(messages, "messages");
      assertOrg(campaigns, "campaigns");
      assertOrg(invoices, "invoices");

      const zip = createZipStore([
        {
          name: "companies.csv",
          data: toCsv(companies.map((r) => flattenRow(r as unknown as Record<string, unknown>))),
        },
        {
          name: "contacts.csv",
          data: toCsv(contacts.map((r) => flattenRow(r as unknown as Record<string, unknown>))),
        },
        {
          name: "opportunities.csv",
          data: toCsv(
            opportunities.map((r) =>
              flattenRow(r as unknown as Record<string, unknown>)
            )
          ),
        },
        {
          name: "conversations.csv",
          data: toCsv(
            conversations.map((r) =>
              flattenRow(r as unknown as Record<string, unknown>)
            )
          ),
        },
        {
          name: "messages.csv",
          data: toCsv(messages.map((r) => flattenRow(r as unknown as Record<string, unknown>))),
        },
        {
          name: "campaigns.csv",
          data: toCsv(campaigns.map((r) => flattenRow(r as unknown as Record<string, unknown>))),
        },
        {
          name: "invoices.csv",
          data: toCsv(invoices.map((r) => flattenRow(r as unknown as Record<string, unknown>))),
        },
        {
          name: "manifest.json",
          data: JSON.stringify(
            {
              organizationId: orgId,
              exportedAt: new Date().toISOString(),
              counts: {
                companies: companies.length,
                contacts: contacts.length,
                opportunities: opportunities.length,
                conversations: conversations.length,
                messages: messages.length,
                campaigns: campaigns.length,
                invoices: invoices.length,
              },
              rowCap: ROW_CAP,
            },
            null,
            2
          ),
        },
      ]);

      const dir = join(exportRootDir(), orgId);
      await mkdir(dir, { recursive: true });
      const filePath = join(dir, `${job.id}.zip`);
      await writeFile(filePath, zip);

      const expiresAt = new Date(Date.now() + TTL_MS);
      await prisma.dataExportJob.update({
        where: { id: jobId },
        data: {
          status: DataExportStatus.READY,
          filePath,
          fileSizeBytes: zip.length,
          expiresAt,
          completedAt: new Date(),
          error: null,
        },
      });

      await writeAuditLog({
        organizationId: orgId,
        userId: job.requestedByUserId,
        action: "privacy.data_export_ready",
        entityType: "data_export_job",
        entityId: job.id,
        newValues: {
          bytes: zip.length,
          expiresAt: expiresAt.toISOString(),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.dataExportJob.update({
        where: { id: jobId },
        data: {
          status: DataExportStatus.FAILED,
          error: message,
          completedAt: new Date(),
        },
      });
      throw err;
    }
  }

  async getLatestForOrg(organizationId: string) {
    return prisma.dataExportJob.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
  }

  async getJobForOrg(jobId: string, organizationId: string) {
    const job = await prisma.dataExportJob.findFirst({
      where: { id: jobId, organizationId },
    });
    if (!job) throw new NotFoundError("Export job not found");
    return job;
  }

  async getDownloadable(token: string, organizationId: string) {
    const job = await prisma.dataExportJob.findUnique({
      where: { downloadToken: token },
    });
    if (!job) throw new NotFoundError("Export not found");
    if (job.organizationId !== organizationId) {
      throw new ForbiddenError("Export belongs to another organization");
    }
    if (job.status === DataExportStatus.EXPIRED) {
      throw new ValidationError("Export link expired");
    }
    if (job.status !== DataExportStatus.READY || !job.filePath) {
      throw new ValidationError("Export is not ready yet");
    }
    if (job.expiresAt && job.expiresAt < new Date()) {
      await prisma.dataExportJob.update({
        where: { id: job.id },
        data: { status: DataExportStatus.EXPIRED },
      });
      throw new ValidationError("Export link expired");
    }
    return job;
  }

  async deleteFileQuiet(path: string | null | undefined) {
    if (!path) return;
    try {
      await unlink(path);
    } catch {
      /* ignore */
    }
  }
}

export const privacyExportService = new PrivacyExportService();

/** Test helper — ensure CSV/zip never mixes org rows */
export function assertAllSameOrg(
  rows: Array<{ organizationId: string }>,
  organizationId: string
): boolean {
  return rows.every((r) => r.organizationId === organizationId);
}

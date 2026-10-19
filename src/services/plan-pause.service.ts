/**
 * B2: soft-pause extras when limits drop below usage.
 * Never deletes; never pauses primary company_admin.
 */

import prisma from "@/lib/db/prisma";
import { FEATURE_KEYS, type FeatureKey } from "@/lib/billing/features";
import { MembershipStatus, PlanLimitNoticeStatus } from "@prisma/client";
import { organizationService } from "@/services/organization.service";
import { logger } from "@/lib/logger";

const PAUSE_REASON = "plan_limit";
const NOTICE_DAYS = 7;

export type SeatResourceKind =
  | "users"
  | "outbound_mailboxes"
  | "campaigns"
  | "sequences"
  | "icps"
  | "connectors";

const SEAT_KEYS: FeatureKey[] = [
  FEATURE_KEYS.USERS,
  FEATURE_KEYS.OUTBOUND_MAILBOXES,
  FEATURE_KEYS.CAMPAIGNS,
  FEATURE_KEYS.SEQUENCES,
  FEATURE_KEYS.ICPS,
  FEATURE_KEYS.CONNECTORS,
];

export function isSeatFeatureKey(key: string): key is SeatResourceKind {
  return (SEAT_KEYS as string[]).includes(key);
}

type ResourceRow = { id: string; createdAt: Date; label: string };

export class PlanPauseService {
  async listActiveResources(
    organizationId: string,
    featureKey: string
  ): Promise<ResourceRow[]> {
    switch (featureKey) {
      case FEATURE_KEYS.USERS: {
        const rows = await prisma.organizationUser.findMany({
          where: {
            organizationId,
            status: MembershipStatus.ACTIVE,
            pausedAt: null,
          },
          include: {
            user: { select: { email: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: "desc" },
        });
        return rows.map((r) => ({
          id: r.id,
          createdAt: r.createdAt,
          label: `${r.user.firstName} ${r.user.lastName} <${r.user.email}>${
            r.isPrimaryAdmin ? " (primary admin)" : ""
          }`,
          isPrimaryAdmin: r.isPrimaryAdmin,
        })) as ResourceRow[];
      }
      case FEATURE_KEYS.OUTBOUND_MAILBOXES: {
        const rows = await prisma.outboundMailbox.findMany({
          where: { organizationId, pausedAt: null },
          include: {
            emailAccount: { select: { email: true } },
          },
          orderBy: { createdAt: "desc" },
        });
        return rows.map((r) => ({
          id: r.id,
          createdAt: r.createdAt,
          label: r.emailAccount.email,
        }));
      }
      case FEATURE_KEYS.CAMPAIGNS: {
        const rows = await prisma.campaign.findMany({
          where: { organizationId, deletedAt: null, pausedAt: null },
          orderBy: { createdAt: "desc" },
        });
        return rows.map((r) => ({
          id: r.id,
          createdAt: r.createdAt,
          label: r.name,
        }));
      }
      case FEATURE_KEYS.SEQUENCES: {
        const rows = await prisma.outreachSequence.findMany({
          where: { organizationId, pausedAt: null },
          orderBy: { createdAt: "desc" },
        });
        return rows.map((r) => ({
          id: r.id,
          createdAt: r.createdAt,
          label: r.name,
        }));
      }
      case FEATURE_KEYS.ICPS: {
        const rows = await prisma.icp.findMany({
          where: { organizationId, status: "ACTIVE", pausedAt: null },
          orderBy: { createdAt: "desc" },
        });
        return rows.map((r) => ({
          id: r.id,
          createdAt: r.createdAt,
          label: r.name,
        }));
      }
      case FEATURE_KEYS.CONNECTORS: {
        const rows = await prisma.sourceConnector.findMany({
          where: { organizationId, pausedAt: null },
          orderBy: { createdAt: "desc" },
        });
        return rows.map((r) => ({
          id: r.id,
          createdAt: r.createdAt,
          label: `${r.name} (${r.provider})`,
        }));
      }
      default:
        return [];
    }
  }

  /** Count seats excluding plan-paused rows. */
  async countActiveSeats(
    organizationId: string,
    featureKey: FeatureKey
  ): Promise<number> {
    switch (featureKey) {
      case FEATURE_KEYS.USERS:
        return prisma.organizationUser.count({
          where: {
            organizationId,
            status: MembershipStatus.ACTIVE,
            pausedAt: null,
          },
        });
      case FEATURE_KEYS.OUTBOUND_MAILBOXES:
        return prisma.outboundMailbox.count({
          where: {
            organizationId,
            status: "ACTIVE",
            pausedAt: null,
          },
        });
      case FEATURE_KEYS.CAMPAIGNS:
        return prisma.campaign.count({
          where: { organizationId, deletedAt: null, pausedAt: null },
        });
      case FEATURE_KEYS.SEQUENCES:
        return prisma.outreachSequence.count({
          where: { organizationId, pausedAt: null },
        });
      case FEATURE_KEYS.ICPS:
        return prisma.icp.count({
          where: { organizationId, status: "ACTIVE", pausedAt: null },
        });
      case FEATURE_KEYS.CONNECTORS:
        return prisma.sourceConnector.count({
          where: { organizationId, pausedAt: null },
        });
      default:
        return 0;
    }
  }

  /**
   * Preview pause impact for a proposed limit (null = unlimited).
   */
  async previewPauseImpact(
    organizationId: string,
    featureKey: string,
    newLimit: number | null
  ): Promise<{
    featureKey: string;
    currentCount: number;
    newLimit: number | null;
    overBy: number;
    wouldPause: ResourceRow[];
  }> {
    const resources = await this.listActiveResources(organizationId, featureKey);
    // Never pause primary admin — exclude from pause candidates
    const pausable =
      featureKey === FEATURE_KEYS.USERS
        ? (
            resources as Array<ResourceRow & { isPrimaryAdmin?: boolean }>
          ).filter((r) => !r.isPrimaryAdmin)
        : resources;
    const protectedCount =
      featureKey === FEATURE_KEYS.USERS
        ? resources.length - pausable.length
        : 0;
    const currentCount = resources.length;
    if (newLimit == null || newLimit < 0 || currentCount <= newLimit) {
      return {
        featureKey,
        currentCount,
        newLimit,
        overBy: 0,
        wouldPause: [],
      };
    }
    // Keep oldest (or primary) up to limit; pause newest first
    const keepSlots = Math.max(0, newLimit - protectedCount);
    const wouldPause = pausable.slice(0, Math.max(0, pausable.length - keepSlots));
    return {
      featureKey,
      currentCount,
      newLimit,
      overBy: currentCount - newLimit,
      wouldPause,
    };
  }

  /**
   * Open a 7-day notice (apply now) so tenant can choose what stays.
   * Marks pauseNoticeAt on candidates; does not pause yet.
   */
  async openNotice(input: {
    organizationId: string;
    featureKey: string;
    allowedCount: number;
    planVersionId?: string | null;
    actorUserId?: string | null;
  }) {
    const now = new Date();
    const deadlineAt = new Date(now.getTime() + NOTICE_DAYS * 86_400_000);
    const impact = await this.previewPauseImpact(
      input.organizationId,
      input.featureKey,
      input.allowedCount
    );
    if (impact.overBy <= 0) return null;

    // Cancel prior pending for same feature
    await prisma.planLimitNotice.updateMany({
      where: {
        organizationId: input.organizationId,
        featureKey: input.featureKey,
        status: PlanLimitNoticeStatus.PENDING,
      },
      data: { status: PlanLimitNoticeStatus.RESOLVED, resolvedAt: now },
    });

    const notice = await prisma.planLimitNotice.create({
      data: {
        organizationId: input.organizationId,
        featureKey: input.featureKey,
        allowedCount: input.allowedCount,
        planVersionId: input.planVersionId ?? null,
        status: PlanLimitNoticeStatus.PENDING,
        noticeAt: now,
        deadlineAt,
        emailStubSentAt: now,
      },
    });

    // Mark notice on candidates (newest first) without pausing yet
    for (const row of impact.wouldPause) {
      await this.setPauseNoticeAt(input.featureKey, row.id, now);
    }

    await organizationService.writePlatformAudit({
      actorUserId: input.actorUserId,
      action: "plan_limit.notice_opened",
      targetType: "plan_limit_notice",
      targetId: notice.id,
      organizationId: input.organizationId,
      after: {
        featureKey: input.featureKey,
        allowedCount: input.allowedCount,
        deadlineAt: deadlineAt.toISOString(),
        overBy: impact.overBy,
        emailStub: `Would email tenant admin: plan now allows ${input.allowedCount} ${input.featureKey}`,
      },
    });

    logger.info("plan limit notice opened (email stub)", {
      organizationId: input.organizationId,
      featureKey: input.featureKey,
      noticeId: notice.id,
    });

    return notice;
  }

  async setPauseNoticeAt(featureKey: string, id: string, at: Date | null) {
    const data = { pauseNoticeAt: at };
    switch (featureKey) {
      case FEATURE_KEYS.USERS:
        await prisma.organizationUser.update({ where: { id }, data });
        break;
      case FEATURE_KEYS.OUTBOUND_MAILBOXES:
        await prisma.outboundMailbox.update({ where: { id }, data });
        break;
      case FEATURE_KEYS.CAMPAIGNS:
        await prisma.campaign.update({ where: { id }, data });
        break;
      case FEATURE_KEYS.SEQUENCES:
        await prisma.outreachSequence.update({ where: { id }, data });
        break;
      case FEATURE_KEYS.ICPS:
        await prisma.icp.update({ where: { id }, data });
        break;
      case FEATURE_KEYS.CONNECTORS:
        await prisma.sourceConnector.update({ where: { id }, data });
        break;
    }
  }

  async pauseResource(featureKey: string, id: string, reason = PAUSE_REASON) {
    const now = new Date();
    const data = { pausedAt: now, pauseReason: reason, pauseNoticeAt: null as Date | null };
    switch (featureKey) {
      case FEATURE_KEYS.USERS: {
        const row = await prisma.organizationUser.findUnique({ where: { id } });
        if (!row || row.isPrimaryAdmin) return false;
        await prisma.organizationUser.update({ where: { id }, data });
        return true;
      }
      case FEATURE_KEYS.OUTBOUND_MAILBOXES:
        await prisma.outboundMailbox.update({
          where: { id },
          data: { ...data, status: "PAUSED" },
        });
        return true;
      case FEATURE_KEYS.CAMPAIGNS:
        await prisma.campaign.update({
          where: { id },
          data: { ...data, status: "PAUSED" },
        });
        return true;
      case FEATURE_KEYS.SEQUENCES:
        await prisma.outreachSequence.update({
          where: { id },
          data: { ...data, status: "PAUSED" },
        });
        return true;
      case FEATURE_KEYS.ICPS:
        await prisma.icp.update({ where: { id }, data });
        return true;
      case FEATURE_KEYS.CONNECTORS:
        await prisma.sourceConnector.update({ where: { id }, data });
        return true;
      default:
        return false;
    }
  }

  async unpauseResource(featureKey: string, id: string) {
    const data = {
      pausedAt: null as Date | null,
      pauseReason: null as string | null,
      pauseNoticeAt: null as Date | null,
    };
    switch (featureKey) {
      case FEATURE_KEYS.USERS:
        await prisma.organizationUser.update({ where: { id }, data });
        break;
      case FEATURE_KEYS.OUTBOUND_MAILBOXES:
        await prisma.outboundMailbox.update({
          where: { id },
          data: { ...data, status: "ACTIVE" },
        });
        break;
      case FEATURE_KEYS.CAMPAIGNS:
        await prisma.campaign.update({
          where: { id },
          data: { ...data, status: "ACTIVE" },
        });
        break;
      case FEATURE_KEYS.SEQUENCES:
        await prisma.outreachSequence.update({
          where: { id },
          data: { ...data, status: "ACTIVE" },
        });
        break;
      case FEATURE_KEYS.ICPS:
        await prisma.icp.update({ where: { id }, data });
        break;
      case FEATURE_KEYS.CONNECTORS:
        await prisma.sourceConnector.update({ where: { id }, data });
        break;
    }
  }

  /** Tenant chose which ids stay active; pause the rest immediately. */
  async resolveChoice(input: {
    noticeId: string;
    organizationId: string;
    selectedIds: string[];
    actorUserId?: string | null;
  }) {
    const notice = await prisma.planLimitNotice.findFirst({
      where: {
        id: input.noticeId,
        organizationId: input.organizationId,
        status: PlanLimitNoticeStatus.PENDING,
      },
    });
    if (!notice) throw new Error("Notice not found or already resolved");

    const resources = await this.listActiveResources(
      input.organizationId,
      notice.featureKey
    );
    const selected = new Set(input.selectedIds.slice(0, notice.allowedCount));

    // Always keep primary admin for users
    if (notice.featureKey === FEATURE_KEYS.USERS) {
      for (const r of resources as Array<ResourceRow & { isPrimaryAdmin?: boolean }>) {
        if (r.isPrimaryAdmin) selected.add(r.id);
      }
    }

    // If under-selected, keep oldest extras until allowedCount
    if (selected.size < notice.allowedCount) {
      const oldestFirst = [...resources].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );
      for (const r of oldestFirst) {
        if (selected.size >= notice.allowedCount) break;
        selected.add(r.id);
      }
    }

    let paused = 0;
    for (const r of resources) {
      if (selected.has(r.id)) {
        await this.setPauseNoticeAt(notice.featureKey, r.id, null);
        continue;
      }
      if (await this.pauseResource(notice.featureKey, r.id)) paused++;
    }

    const now = new Date();
    await prisma.planLimitNotice.update({
      where: { id: notice.id },
      data: {
        selectedIds: [...selected],
        status: PlanLimitNoticeStatus.APPLIED,
        resolvedAt: now,
        appliedAt: now,
      },
    });

    await organizationService.writePlatformAudit({
      actorUserId: input.actorUserId,
      action: "plan_limit.choice_applied",
      targetType: "plan_limit_notice",
      targetId: notice.id,
      organizationId: input.organizationId,
      after: { selectedIds: [...selected], paused },
    });

    return { paused, kept: selected.size };
  }

  /** Lifecycle: apply expired notices (newest first if no choice). */
  async applyDueNotices(now = new Date()): Promise<number> {
    const due = await prisma.planLimitNotice.findMany({
      where: {
        status: PlanLimitNoticeStatus.PENDING,
        deadlineAt: { lte: now },
      },
    });
    let applied = 0;
    for (const notice of due) {
      try {
        const resources = await this.listActiveResources(
          notice.organizationId,
          notice.featureKey
        );
        const selected = new Set(notice.selectedIds);
        if (selected.size === 0) {
          // Keep oldest up to allowedCount; pause newest
          const oldestFirst = [...resources].sort(
            (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
          );
          for (const r of oldestFirst.slice(0, notice.allowedCount)) {
            selected.add(r.id);
          }
          if (notice.featureKey === FEATURE_KEYS.USERS) {
            for (const r of resources as Array<
              ResourceRow & { isPrimaryAdmin?: boolean }
            >) {
              if (r.isPrimaryAdmin) selected.add(r.id);
            }
          }
        }
        for (const r of resources) {
          if (selected.has(r.id)) {
            await this.setPauseNoticeAt(notice.featureKey, r.id, null);
          } else {
            await this.pauseResource(notice.featureKey, r.id);
          }
        }
        await prisma.planLimitNotice.update({
          where: { id: notice.id },
          data: {
            selectedIds: [...selected],
            status: PlanLimitNoticeStatus.APPLIED,
            appliedAt: now,
            resolvedAt: notice.resolvedAt ?? now,
          },
        });
        await organizationService.writePlatformAudit({
          action: "plan_limit.deadline_applied",
          targetType: "plan_limit_notice",
          targetId: notice.id,
          organizationId: notice.organizationId,
          after: { selectedIds: [...selected] },
        });
        applied++;
      } catch (err) {
        logger.error("plan limit notice apply failed", {
          noticeId: notice.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return applied;
  }

  /**
   * After override expiry / version apply: if over limit, open notice.
   */
  async reconcileOrgLimits(
    organizationId: string,
    limits: Record<string, number | null>,
    planVersionId?: string | null,
    actorUserId?: string | null
  ) {
    const notices = [];
    for (const key of SEAT_KEYS) {
      const limit = limits[key];
      if (limit == null) continue;
      const impact = await this.previewPauseImpact(organizationId, key, limit);
      if (impact.overBy > 0) {
        const n = await this.openNotice({
          organizationId,
          featureKey: key,
          allowedCount: limit,
          planVersionId,
          actorUserId,
        });
        if (n) notices.push(n);
      }
    }
    return notices;
  }

  async listPendingNotices(organizationId: string) {
    return prisma.planLimitNotice.findMany({
      where: {
        organizationId,
        status: PlanLimitNoticeStatus.PENDING,
      },
      orderBy: { deadlineAt: "asc" },
    });
  }
}

export const planPauseService = new PlanPauseService();

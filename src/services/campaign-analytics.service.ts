import prisma from "@/lib/db/prisma";
import {
  FollowUpJobStatus,
  SequenceEnrollmentStatus,
  SequenceEnrollmentStopReason,
  SequenceExecutionStatus,
} from "@prisma/client";
import { NotFoundError } from "@/lib/api/response";

export type CampaignCanonicalAnalytics = {
  enrollments: {
    total: number;
    active: number;
    pending: number;
    processing: number;
    paused: number;
    completed: number;
    failed: number;
    stopped: number;
  };
  executions: {
    total: number;
    success: number;
    failed: number;
    skipped: number;
  };
  outcomes: {
    replies: number;
    meetings: number;
    unsubscribed: number;
    bouncedOrSuppressed: number;
  };
  funnel: {
    contactsEnrolled: number;
    messagesSent: number;
    replies: number;
    meetings: number;
    opportunities: number;
    deals: number;
    revenue: number | null;
  };
  limitations: string[];
};

export type CampaignLegacyAnalytics = {
  campaignLeads: number;
  bridged: number;
  notBridged: number;
  pendingFollowUpJobs: number;
  processingFollowUpJobs: number;
  legacyLeads: number;
  automatedLeads: number;
  repliedLeads: number;
  hotLeads: number;
};

export type SequenceAnalytics = {
  sequenceId: string;
  enrollments: CampaignCanonicalAnalytics["enrollments"];
  executions: CampaignCanonicalAnalytics["executions"];
  replies: number;
  limitations: string[];
};

const LIMITATIONS = [
  "Open/click events are written via first-party pixel + click redirects (/t/o, /t/c). Opens undercount when images are blocked; Apple MPP may inflate opens.",
  "Bounce count uses enrollment stopReason only (not provider bounce webhooks).",
  "Revenue is summed from Deals linked to Opportunities that share campaignId or enrollment.opportunityId.",
];

export class CampaignAnalyticsService {
  async getCampaignAnalytics(organizationId: string, campaignId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId, deletedAt: null },
      select: { id: true, name: true, status: true },
    });
    if (!campaign) throw new NotFoundError("Campaign not found");

    const [canonical, legacy] = await Promise.all([
      this.canonicalForCampaign(organizationId, campaignId),
      this.legacyForCampaign(organizationId, campaignId),
    ]);

    return { campaign, canonical, legacy };
  }

  async getSequenceAnalytics(organizationId: string, sequenceId: string) {
    const sequence = await prisma.outreachSequence.findFirst({
      where: { id: sequenceId, organizationId },
      select: { id: true, name: true, status: true },
    });
    if (!sequence) throw new NotFoundError("Sequence not found");

    const enrollments = await this.enrollmentStatusCounts(organizationId, {
      sequenceId,
    });
    const executions = await this.executionCounts(organizationId, {
      sequenceId,
    });
    const replies = await prisma.sequenceEnrollment.count({
      where: {
        organizationId,
        sequenceId,
        stopReason: SequenceEnrollmentStopReason.REPLIED,
      },
    });

    return {
      sequence,
      analytics: {
        sequenceId,
        enrollments,
        executions,
        replies,
        limitations: LIMITATIONS,
      } satisfies SequenceAnalytics,
    };
  }

  private async canonicalForCampaign(
    organizationId: string,
    campaignId: string
  ): Promise<CampaignCanonicalAnalytics> {
    const enrollments = await this.enrollmentStatusCounts(organizationId, {
      campaignId,
    });
    const executions = await this.executionCounts(organizationId, {
      campaignId,
    });

    const [replies, meetingsStopped, unsubscribed, bouncedOrSuppressed] =
      await Promise.all([
        prisma.sequenceEnrollment.count({
          where: {
            organizationId,
            campaignId,
            stopReason: SequenceEnrollmentStopReason.REPLIED,
          },
        }),
        prisma.sequenceEnrollment.count({
          where: {
            organizationId,
            campaignId,
            stopReason: SequenceEnrollmentStopReason.MEETING_BOOKED,
          },
        }),
        prisma.sequenceEnrollment.count({
          where: {
            organizationId,
            campaignId,
            stopReason: SequenceEnrollmentStopReason.UNSUBSCRIBED,
          },
        }),
        prisma.sequenceEnrollment.count({
          where: {
            organizationId,
            campaignId,
            stopReason: {
              in: [
                SequenceEnrollmentStopReason.BOUNCED,
                SequenceEnrollmentStopReason.SUPPRESSED,
              ],
            },
          },
        }),
      ]);

    const enrollmentRows = await prisma.sequenceEnrollment.findMany({
      where: { organizationId, campaignId },
      select: { contactId: true, opportunityId: true },
    });
    const contactIds = [
      ...new Set(enrollmentRows.map((e) => e.contactId).filter(Boolean)),
    ];
    const opportunityIds = [
      ...new Set(
        enrollmentRows
          .map((e) => e.opportunityId)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    const linkedOpps = await prisma.opportunity.findMany({
      where: {
        organizationId,
        OR: [
          { campaignId },
          ...(opportunityIds.length ? [{ id: { in: opportunityIds } }] : []),
        ],
      },
      select: { id: true },
    });
    const allOppIds = [...new Set(linkedOpps.map((o) => o.id))];

    const meetings =
      contactIds.length || allOppIds.length
        ? await prisma.meeting.count({
            where: {
              organizationId,
              OR: [
                ...(contactIds.length
                  ? [{ contactId: { in: contactIds } }]
                  : []),
                ...(allOppIds.length
                  ? [{ opportunityId: { in: allOppIds } }]
                  : []),
              ],
            },
          })
        : 0;

    const deals = allOppIds.length
      ? await prisma.deal.findMany({
          where: {
            organizationId,
            opportunityId: { in: allOppIds },
            deletedAt: null,
          },
          select: { id: true, estimatedValue: true },
        })
      : [];

    let revenue: number | null = null;
    if (deals.length) {
      const dealIds = deals.map((d) => d.id);
      const revenues = await prisma.revenue.findMany({
        where: { organizationId, dealId: { in: dealIds } },
        select: { amount: true },
      });
      if (revenues.length) {
        revenue = revenues.reduce((s, r) => s + Number(r.amount), 0);
      } else {
        revenue = deals.reduce((s, d) => s + Number(d.estimatedValue ?? 0), 0);
      }
    }

    return {
      enrollments,
      executions,
      outcomes: {
        replies,
        meetings: Math.max(meetings, meetingsStopped),
        unsubscribed,
        bouncedOrSuppressed,
      },
      funnel: {
        contactsEnrolled: enrollments.total,
        messagesSent: executions.success,
        replies,
        meetings: Math.max(meetings, meetingsStopped),
        opportunities: allOppIds.length,
        deals: deals.length,
        revenue,
      },
      limitations: LIMITATIONS,
    };
  }

  private async legacyForCampaign(
    organizationId: string,
    campaignId: string
  ): Promise<CampaignLegacyAnalytics> {
    const [
      campaignLeads,
      bridged,
      pendingFollowUpJobs,
      processingFollowUpJobs,
      legacyLeads,
      automatedLeads,
      repliedLeads,
      hotLeads,
    ] = await Promise.all([
      prisma.campaignLead.count({ where: { campaignId } }),
      prisma.campaignLead.count({
        where: { campaignId, bridgedAt: { not: null } },
      }),
      prisma.followUpJob.count({
        where: {
          organizationId,
          status: FollowUpJobStatus.PENDING,
          lead: { campaignId, deletedAt: null },
        },
      }),
      prisma.followUpJob.count({
        where: {
          organizationId,
          status: FollowUpJobStatus.PROCESSING,
          lead: { campaignId, deletedAt: null },
        },
      }),
      prisma.lead.count({
        where: { organizationId, campaignId, deletedAt: null },
      }),
      prisma.lead.count({
        where: {
          organizationId,
          campaignId,
          deletedAt: null,
          automationStatus: { not: "IDLE" },
        },
      }),
      prisma.lead.count({
        where: {
          organizationId,
          campaignId,
          deletedAt: null,
          status: { in: ["REPLIED", "INTERESTED", "MEETING"] },
        },
      }),
      prisma.lead.count({
        where: {
          organizationId,
          campaignId,
          deletedAt: null,
          scoreCategory: "HOT",
        },
      }),
    ]);

    return {
      campaignLeads,
      bridged,
      notBridged: Math.max(0, campaignLeads - bridged),
      pendingFollowUpJobs,
      processingFollowUpJobs,
      legacyLeads,
      automatedLeads,
      repliedLeads,
      hotLeads,
    };
  }

  private async enrollmentStatusCounts(
    organizationId: string,
    filter: { campaignId?: string; sequenceId?: string }
  ) {
    const base = {
      organizationId,
      ...(filter.campaignId ? { campaignId: filter.campaignId } : {}),
      ...(filter.sequenceId ? { sequenceId: filter.sequenceId } : {}),
    };

    const [
      total,
      active,
      pending,
      processing,
      paused,
      completed,
      failed,
      stopped,
    ] = await Promise.all([
      prisma.sequenceEnrollment.count({ where: base }),
      prisma.sequenceEnrollment.count({
        where: { ...base, status: SequenceEnrollmentStatus.ACTIVE },
      }),
      prisma.sequenceEnrollment.count({
        where: { ...base, status: SequenceEnrollmentStatus.PENDING },
      }),
      prisma.sequenceEnrollment.count({
        where: { ...base, status: SequenceEnrollmentStatus.PROCESSING },
      }),
      prisma.sequenceEnrollment.count({
        where: { ...base, status: SequenceEnrollmentStatus.PAUSED },
      }),
      prisma.sequenceEnrollment.count({
        where: { ...base, status: SequenceEnrollmentStatus.COMPLETED },
      }),
      prisma.sequenceEnrollment.count({
        where: { ...base, status: SequenceEnrollmentStatus.FAILED },
      }),
      prisma.sequenceEnrollment.count({
        where: { ...base, status: SequenceEnrollmentStatus.STOPPED },
      }),
    ]);

    return {
      total,
      active,
      pending,
      processing,
      paused,
      completed,
      failed,
      stopped,
    };
  }

  private async executionCounts(
    organizationId: string,
    filter: { campaignId?: string; sequenceId?: string }
  ) {
    const enrollmentFilter = {
      organizationId,
      ...(filter.campaignId ? { campaignId: filter.campaignId } : {}),
      ...(filter.sequenceId ? { sequenceId: filter.sequenceId } : {}),
    };

    const [total, success, failed, skipped] = await Promise.all([
      prisma.sequenceEnrollmentExecution.count({
        where: { organizationId, enrollment: enrollmentFilter },
      }),
      prisma.sequenceEnrollmentExecution.count({
        where: {
          organizationId,
          status: SequenceExecutionStatus.SUCCESS,
          enrollment: enrollmentFilter,
        },
      }),
      prisma.sequenceEnrollmentExecution.count({
        where: {
          organizationId,
          status: SequenceExecutionStatus.FAILED,
          enrollment: enrollmentFilter,
        },
      }),
      prisma.sequenceEnrollmentExecution.count({
        where: {
          organizationId,
          status: SequenceExecutionStatus.SKIPPED,
          enrollment: enrollmentFilter,
        },
      }),
    ]);

    return { total, success, failed, skipped };
  }
}

export const campaignAnalyticsService = new CampaignAnalyticsService();

import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { outreachSequenceService } from "@/services/outreach-sequence.service";
import { sequenceEnrollmentService } from "@/services/sequence-enrollment.service";
import { campaignAnalyticsService } from "@/services/campaign-analytics.service";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAnyOrgPermission, hasOrgPermission } from "@/lib/tenant/scope";
import { SequenceBuilder } from "@/components/sequences/sequence-builder";
import { SequenceAnalyticsSummary } from "@/components/sequences/sequence-analytics-summary";
import { EntityRelatedLinks } from "@/components/crm/entity-related-links";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SequenceDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (
    !user?.organizationId ||
    !hasAnyOrgPermission(user, ["sequences.view", "sequences.manage"])
  ) {
    notFound();
  }

  const canManage = hasOrgPermission(user, "sequences.manage");
  const { id } = await params;
  let sequence;
  try {
    sequence = await outreachSequenceService.getById(user.organizationId, id);
  } catch {
    notFound();
  }

  const [enrollments, sequenceAnalytics] = await Promise.all([
    sequenceEnrollmentService.list(user.organizationId, {
      sequenceId: id,
      limit: 50,
    }),
    campaignAnalyticsService
      .getSequenceAnalytics(user.organizationId, id)
      .catch(() => null),
  ]);

  return (
    <div className="space-y-8">
      <Link href="/dashboard/sequences">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </Link>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">{sequence.name}</h2>
        <p className="text-muted-foreground">
          Steps → Enrollments → Campaigns → Conversations → Analytics. Active{" "}
          {sequence.enrollmentStats.active} · Completed{" "}
          {sequence.enrollmentStats.completed} · Stopped{" "}
          {sequence.enrollmentStats.stopped} · Paused{" "}
          {sequence.enrollmentStats.paused}
        </p>
      </div>

      <EntityRelatedLinks
        links={[
          { href: "/dashboard/sequences", label: "All sequences" },
          { href: "/dashboard/campaigns", label: "Campaigns" },
          { href: "/dashboard/conversations", label: "Inbox" },
        ]}
      />

      {sequenceAnalytics ? (
        <SequenceAnalyticsSummary analytics={sequenceAnalytics.analytics} />
      ) : null}

      <SequenceBuilder
        sequenceId={sequence.id}
        canManage={canManage}
        initial={{
          name: sequence.name,
          description: sequence.description,
          status: sequence.status,
          stopOnReply: sequence.stopOnReply,
          stopOnMeeting: sequence.stopOnMeeting,
          stopOnUnsubscribe: sequence.stopOnUnsubscribe,
          steps: sequence.steps,
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enrollments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {enrollments.items.length === 0 ? (
            <p className="text-muted-foreground">No enrollments</p>
          ) : (
            enrollments.items.map((e) => (
              <div key={e.id} className="flex justify-between gap-4">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link
                    href={`/dashboard/contacts/${e.contact.id}`}
                    className="hover:underline"
                  >
                    {e.contact.fullName}
                  </Link>
                  {e.opportunity ? (
                    <Link
                      href={`/dashboard/opportunities/${e.opportunity.id}`}
                      className="text-muted-foreground hover:underline"
                    >
                      · {e.opportunity.stage}
                    </Link>
                  ) : null}
                  {e.campaign ? (
                    <Link
                      href={`/dashboard/campaigns/${e.campaign.id}`}
                      className="text-muted-foreground hover:underline"
                    >
                      · {e.campaign.name}
                    </Link>
                  ) : null}
                  <span className="text-muted-foreground">
                    · step {e.currentStepOrder}
                  </span>
                </span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Badge variant="secondary">{e.status}</Badge>
                  {e.nextRunAt
                    ? format(e.nextRunAt, "MMM d HH:mm")
                    : ""}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

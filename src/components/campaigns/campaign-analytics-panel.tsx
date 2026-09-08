import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  CampaignCanonicalAnalytics,
  CampaignLegacyAnalytics,
} from "@/services/campaign-analytics.service";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export function CampaignAnalyticsPanel({
  canonical,
  legacy,
}: {
  canonical: CampaignCanonicalAnalytics;
  legacy: CampaignLegacyAnalytics;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Analytics</h3>
        <p className="text-sm text-muted-foreground">
          Canonical SequenceEnrollment metrics vs legacy Lead / FollowUpJob path.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Canonical path</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Enrolled" value={canonical.enrollments.total} />
              <Stat label="Active" value={canonical.enrollments.active} />
              <Stat label="Messages sent" value={canonical.funnel.messagesSent} />
              <Stat label="Replies" value={canonical.outcomes.replies} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Completed" value={canonical.enrollments.completed} />
              <Stat label="Stopped" value={canonical.enrollments.stopped} />
              <Stat label="Failed" value={canonical.enrollments.failed} />
              <Stat label="Meetings" value={canonical.outcomes.meetings} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Opportunities" value={canonical.funnel.opportunities} />
              <Stat label="Deals" value={canonical.funnel.deals} />
              <Stat
                label="Revenue"
                value={
                  canonical.funnel.revenue == null
                    ? "—"
                    : canonical.funnel.revenue.toLocaleString()
                }
              />
              <Stat
                label="Bounce/suppress"
                value={canonical.outcomes.bouncedOrSuppressed}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Legacy path</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Campaign leads" value={legacy.campaignLeads} />
              <Stat label="Bridged" value={legacy.bridged} />
              <Stat label="Not bridged" value={legacy.notBridged} />
              <Stat label="Pending follow-ups" value={legacy.pendingFollowUpJobs} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Legacy leads" value={legacy.legacyLeads} />
              <Stat label="AI automated" value={legacy.automatedLeads} />
              <Stat label="Replied (lead)" value={legacy.repliedLeads} />
              <Stat label="Hot leads" value={legacy.hotLeads} />
            </div>
          </CardContent>
        </Card>
      </div>

      {canonical.limitations.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {canonical.limitations.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

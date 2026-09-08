import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SequenceAnalytics } from "@/services/campaign-analytics.service";

export function SequenceAnalyticsSummary({
  analytics,
}: {
  analytics: SequenceAnalytics;
}) {
  const cells = [
    { label: "Enrolled", value: analytics.enrollments.total },
    { label: "Active", value: analytics.enrollments.active },
    { label: "Completed", value: analytics.enrollments.completed },
    { label: "Stopped", value: analytics.enrollments.stopped },
    { label: "Sends (success)", value: analytics.executions.success },
    { label: "Replies", value: analytics.replies },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sequence metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-6">
          {cells.map((c) => (
            <div key={c.label}>
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="text-sm text-muted-foreground">{c.label}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Open/click rates are not shown — those events are not reliably recorded.
        </p>
      </CardContent>
    </Card>
  );
}

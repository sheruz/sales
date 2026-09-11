import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { meetingService } from "@/services/meeting.service";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAnyOrgPermission } from "@/lib/tenant/scope";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/crm/empty-state";

export default async function MeetingsPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/dashboard");
  if (
    !hasAnyOrgPermission(user, ["opportunities.view", "deals.manage"])
  ) {
    redirect("/dashboard");
  }

  const meetings = await meetingService.list(user.organizationId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Meetings</h2>
        <p className="text-muted-foreground">
          Scheduled and completed meetings linked to opportunities.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upcoming & recent</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {meetings.length === 0 ? (
            <EmptyState
              title="No meetings yet"
              description="Book a meeting from an opportunity detail page."
              actionHref="/dashboard/opportunities"
              actionLabel="View opportunities"
            />
          ) : (
            meetings.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium">{m.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(m.date), "MMM d, yyyy HH:mm")}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    {m.company ? (
                      <Link
                        href={`/dashboard/companies/${m.company.id}`}
                        className="text-primary hover:underline"
                      >
                        {m.company.name}
                      </Link>
                    ) : null}
                    {m.contact ? (
                      <Link
                        href={`/dashboard/contacts/${m.contact.id}`}
                        className="text-primary hover:underline"
                      >
                        {m.contact.fullName}
                      </Link>
                    ) : null}
                    {m.opportunityId ? (
                      <Link
                        href={`/dashboard/opportunities/${m.opportunityId}`}
                        className="text-primary hover:underline"
                      >
                        Opportunity
                        {m.opportunity?.stage
                          ? ` · ${m.opportunity.stage}`
                          : ""}
                      </Link>
                    ) : null}
                  </div>
                </div>
                <Badge variant="outline">{m.outcome}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

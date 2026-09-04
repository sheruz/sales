import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { meetingService } from "@/services/meeting.service";
import { getCurrentUser } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function MeetingsPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/dashboard");

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
            <p className="text-sm text-muted-foreground">
              No meetings yet. Book one from an opportunity detail page.
            </p>
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
                    {m.company ? ` · ${m.company.name}` : ""}
                    {m.contact ? ` · ${m.contact.fullName}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{m.outcome}</Badge>
                  {m.opportunityId && (
                    <Link
                      href={`/dashboard/opportunities/${m.opportunityId}`}
                      className="text-xs text-primary hover:underline"
                    >
                      Opportunity
                    </Link>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

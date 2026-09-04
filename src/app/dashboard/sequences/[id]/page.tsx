import { notFound } from "next/navigation";
import { format } from "date-fns";
import { outreachSequenceService } from "@/services/outreach-sequence.service";
import { sequenceEnrollmentService } from "@/services/sequence-enrollment.service";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAnyOrgPermission } from "@/lib/tenant/scope";
import { Badge } from "@/components/ui/badge";
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

  const { id } = await params;
  let sequence;
  try {
    sequence = await outreachSequenceService.getById(user.organizationId, id);
  } catch {
    notFound();
  }

  const enrollments = await sequenceEnrollmentService.list(
    user.organizationId,
    { sequenceId: id, limit: 50 }
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight">{sequence.name}</h2>
          <Badge variant="secondary">{sequence.status}</Badge>
        </div>
        <p className="text-muted-foreground">
          {sequence.description || "Outreach sequence"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Active {sequence.enrollmentStats.active} · Completed{" "}
          {sequence.enrollmentStats.completed} · Stopped{" "}
          {sequence.enrollmentStats.stopped} · Paused{" "}
          {sequence.enrollmentStats.paused}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Steps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {sequence.steps.map((step) => (
            <div key={step.id} className="border-b pb-2 last:border-0">
              <div className="font-medium">
                Step {step.stepOrder} · {step.channel}
                {step.delayMinutes
                  ? ` · wait ${step.delayMinutes} min`
                  : " · immediate"}
              </div>
              <div className="text-muted-foreground">
                {step.subjectTemplate || "(no subject)"}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

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
                <span>
                  {e.contact.fullName}
                  {e.opportunity ? ` · opp ${e.opportunity.stage}` : ""}
                  {" · step "}
                  {e.currentStepOrder}
                </span>
                <span className="text-muted-foreground">
                  {e.status}
                  {e.nextRunAt
                    ? ` · ${format(e.nextRunAt, "MMM d HH:mm")}`
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

import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { getUserReadiness } from "@/lib/integrations/readiness";

type Readiness = Awaited<ReturnType<typeof getUserReadiness>>;

export function SetupChecklist({ readiness }: { readiness: Readiness }) {
  if (readiness.percentComplete === 100) return null;

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle>Complete your setup</CardTitle>
        <CardDescription>
          Connect your accounts to run AI sales automation. You pay OpenAI and email providers directly.
        </CardDescription>
        <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${readiness.percentComplete}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {readiness.completedCount} of {readiness.totalSteps} complete ({readiness.percentComplete}%)
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {readiness.steps.map((step) => (
          <div key={step.id} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm">
              {step.done ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span className={step.done ? "text-muted-foreground line-through" : ""}>{step.label}</span>
            </div>
            {!step.done && (
              <Link href={step.href}>
                <Button size="sm" variant="outline">Set up</Button>
              </Link>
            )}
          </div>
        ))}
        {!readiness.readyForAutopilot && (
          <p className="text-sm text-amber-600 pt-2">
            Autopilot requires AI + Email integrations before it can run.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

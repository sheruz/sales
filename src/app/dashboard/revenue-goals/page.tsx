import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { revenueGoalService } from "@/services/revenue-goal.service";
import { RevenueGoalsClient } from "@/components/business-brain/revenue-goals-client";

export default async function RevenueGoalsPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/dashboard");

  const goals = await revenueGoalService.list(user.organizationId);

  const serialized = goals.map(
    (g: {
      id: string;
      name: string;
      targetRevenue: { toString(): string } | number;
      currency: string;
      targetDeals: number | null;
      averageDealValue: { toString(): string } | number | null;
      startDate: Date | null;
      endDate: Date | null;
      targetRegions: string[];
      targetIndustries: string[];
      status: string;
    }) => ({
      id: g.id,
      name: g.name,
      targetRevenue: Number(g.targetRevenue),
      currency: g.currency,
      targetDeals: g.targetDeals,
      averageDealValue:
        g.averageDealValue != null ? Number(g.averageDealValue) : null,
      startDate: g.startDate ? g.startDate.toISOString().slice(0, 10) : null,
      endDate: g.endDate ? g.endDate.toISOString().slice(0, 10) : null,
      targetRegions: g.targetRegions,
      targetIndustries: g.targetIndustries,
      status: g.status,
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Revenue Goals</h2>
        <p className="text-muted-foreground">
          Set targets manually or describe them in plain language for AI to draft a strategy.
        </p>
      </div>
      <RevenueGoalsClient initialGoals={serialized} />
    </div>
  );
}

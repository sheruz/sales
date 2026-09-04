import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { proposalService } from "@/services/proposal.service";
import { getCurrentUser } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ProposalsPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/dashboard");

  const proposals = await proposalService.list(user.organizationId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Proposals</h2>
        <p className="text-muted-foreground">
          Draft, send, and track proposals tied to opportunities and deals.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All proposals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {proposals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No proposals yet. Create one from an opportunity.
            </p>
          ) : (
            proposals.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium">{p.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.company?.name ?? "—"} · v{p.version} ·{" "}
                    {format(new Date(p.updatedAt), "MMM d, yyyy")}
                    {p.totalPrice != null
                      ? ` · ${p.currency} ${Number(p.totalPrice).toLocaleString()}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{p.status}</Badge>
                  {p.opportunityId && (
                    <Link
                      href={`/dashboard/opportunities/${p.opportunityId}`}
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

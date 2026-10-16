import { appHome } from "@/lib/app-paths";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { proposalService } from "@/services/proposal.service";
import { getCurrentUser } from "@/lib/auth/session";
import { hasOrgPermission } from "@/lib/tenant/scope";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/crm/empty-state";

export default async function ProposalsPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect(appHome());
  if (!hasOrgPermission(user, "deals.manage")) redirect(appHome());

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
            <EmptyState
              title="No proposals yet"
              description="Create a proposal from an opportunity detail page."
              actionHref={appHome("/opportunities")}
              actionLabel="View opportunities"
            />
          ) : (
            proposals.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium">{p.title}</p>
                  <p className="text-xs text-muted-foreground">
                    v{p.version} · {format(new Date(p.updatedAt), "MMM d, yyyy")}
                    {p.totalPrice != null
                      ? ` · ${p.currency} ${Number(p.totalPrice).toLocaleString()}`
                      : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    {p.company ? (
                      <Link
                        href={appHome(`/companies/${p.company.id}`)}
                        className="text-primary hover:underline"
                      >
                        {p.company.name}
                      </Link>
                    ) : null}
                    {p.contact ? (
                      <Link
                        href={appHome(`/contacts/${p.contact.id}`)}
                        className="text-primary hover:underline"
                      >
                        {p.contact.fullName}
                      </Link>
                    ) : null}
                    {p.opportunityId ? (
                      <Link
                        href={appHome(`/opportunities/${p.opportunityId}`)}
                        className="text-primary hover:underline"
                      >
                        Opportunity
                        {p.opportunity?.stage ? ` · ${p.opportunity.stage}` : ""}
                      </Link>
                    ) : null}
                  </div>
                </div>
                <Badge variant="outline">{p.status}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { appOps } from "@/lib/app-paths";
import Link from "next/link";
import { billingTransactionService } from "@/services/billing/billing-transaction.service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PageProps {
  searchParams: Promise<{
    environment?: string;
    provider?: string;
    kind?: string;
  }>;
}

export default async function PlatformTransactionsPage({
  searchParams,
}: PageProps) {
  const sp = await searchParams;
  const { rows, total } = await billingTransactionService.list({
    environment: sp.environment || undefined,
    provider: sp.provider || undefined,
    kind: sp.kind || undefined,
    take: 200,
  });

  const qs = new URLSearchParams();
  if (sp.environment) qs.set("environment", sp.environment);
  if (sp.provider) qs.set("provider", sp.provider);
  if (sp.kind) qs.set("kind", sp.kind);
  qs.set("format", "csv");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Transactions</h2>
          <p className="text-muted-foreground text-sm">
            Paddle/Stripe synced events + manual payments ({total} shown)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            render={<Link href={appOps("/revenue")} />}
          >
            Revenue
          </Button>
          <Button
            variant="outline"
            size="sm"
            render={
              <a href={`/api/platform/transactions?${qs.toString()}`} />
            }
          >
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Pass via query string</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm">
          {[
            { label: "All", href: appOps("/transactions") },
            {
              label: "LIVE",
              href: `${appOps("/transactions")}?environment=production`,
            },
            {
              label: "Test",
              href: `${appOps("/transactions")}?environment=sandbox`,
            },
            {
              label: "Paddle",
              href: `${appOps("/transactions")}?provider=PADDLE`,
            },
            {
              label: "Top-ups",
              href: `${appOps("/transactions")}?kind=topup`,
            },
            {
              label: "Refunds",
              href: `${appOps("/transactions")}?kind=refund`,
            },
          ].map((f) => (
            <Link
              key={f.label}
              href={f.href}
              className="rounded border px-2 py-1 hover:bg-muted"
            >
              {f.label}
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No transactions yet — they appear as webhooks process payments.
            </p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Org</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Net</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Env</TableHead>
                    <TableHead>External</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {r.occurredAt.toISOString().slice(0, 10)}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={appOps(`/companies/${r.organizationId}`)}
                          className="underline-offset-2 hover:underline"
                        >
                          {r.organization.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{r.kind}</Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {r.currency} {Number(r.amount).toFixed(2)}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {r.feeAmount != null ? Number(r.feeAmount).toFixed(2) : "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {r.netAmount != null ? Number(r.netAmount).toFixed(2) : "—"}
                      </TableCell>
                      <TableCell>{r.status}</TableCell>
                      <TableCell>{r.provider}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            r.environment === "production"
                              ? "default"
                              : "outline"
                          }
                        >
                          {r.environment === "production" ? "LIVE" : "Test"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs max-w-[140px] truncate">
                        {r.externalId || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

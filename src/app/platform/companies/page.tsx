import { appOps } from "@/lib/app-paths";
import Link from "next/link";
import { organizationService } from "@/services/organization.service";
import { CreateOrganizationForm } from "@/components/platform/create-organization-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlatformPageHeader } from "@/components/platform/ui/page-header";
import { PlatformEmptyState } from "@/components/platform/ui/empty-state";
import { formatPlatformDate } from "@/lib/platform/format";
import { platformStatusBadge } from "@/lib/platform/status-badge";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function PlatformOrganizationsPage({
  searchParams,
}: PageProps) {
  const sp = await searchParams;
  const q = (sp.q || "").trim().toLowerCase();
  const all = await organizationService.listOrganizations();
  const organizations = q
    ? all.filter(
        (org) =>
          org.name.toLowerCase().includes(q) ||
          org.slug.toLowerCase().includes(q)
      )
    : all;

  return (
    <div className="space-y-6">
      <PlatformPageHeader
        title="Organizations"
        description={
          q
            ? `Customer tenants filtered by “${sp.q}”.`
            : "Customer tenants with their own members, leads, and campaigns."
        }
        actions={<CreateOrganizationForm />}
      />

      <Card>
        <CardHeader>
          <CardTitle>
            {q ? "Matching" : "All"} organizations ({organizations.length})
          </CardTitle>
          <CardDescription>
            Click a row to view members, billing, and actions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {organizations.length === 0 ? (
            <PlatformEmptyState
              title={
                q
                  ? "No organizations match that search."
                  : "No organizations yet."
              }
              description={
                q ? undefined : "Create one to get started."
              }
            />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Leads</TableHead>
                    <TableHead>Campaigns</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organizations.map((org) => {
                    const badge = platformStatusBadge(org.status);
                    return (
                      <TableRow key={org.id}>
                        <TableCell>
                          <Link
                            href={appOps(`/companies/${org.id}`)}
                            className="font-medium hover:underline"
                          >
                            {org.name}
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {org.slug}
                        </TableCell>
                        <TableCell>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell>{org._count.members}</TableCell>
                        <TableCell>{org._count.leads}</TableCell>
                        <TableCell>{org._count.campaigns}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatPlatformDate(org.createdAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

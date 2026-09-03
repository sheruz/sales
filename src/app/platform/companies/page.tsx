import Link from "next/link";
import { format } from "date-fns";
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

function statusVariant(status: string) {
  if (status === "ACTIVE") return "default" as const;
  if (status === "SUSPENDED") return "destructive" as const;
  return "secondary" as const;
}

export default async function PlatformOrganizationsPage() {
  const organizations = await organizationService.listOrganizations();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Organizations</h2>
          <p className="text-muted-foreground">
            Customer tenants with their own members, leads, and campaigns.
          </p>
        </div>
        <CreateOrganizationForm />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All organizations ({organizations.length})</CardTitle>
          <CardDescription>
            Click a row to view members, invite users, or change status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {organizations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No organizations yet. Create one to get started.
            </p>
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
                  {organizations.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell>
                        <Link
                          href={`/platform/companies/${org.id}`}
                          className="font-medium hover:underline"
                        >
                          {org.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {org.slug}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(org.status)}>
                          {org.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{org._count.members}</TableCell>
                      <TableCell>{org._count.leads}</TableCell>
                      <TableCell>{org._count.campaigns}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(org.createdAt, "MMM d, yyyy")}
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

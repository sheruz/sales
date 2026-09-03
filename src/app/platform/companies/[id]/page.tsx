import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { organizationService } from "@/services/organization.service";
import { OrganizationActions } from "@/components/platform/organization-actions";
import { NotFoundError } from "@/lib/api/response";
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
  params: Promise<{ id: string }>;
}

function statusVariant(status: string) {
  if (status === "ACTIVE") return "default" as const;
  if (status === "SUSPENDED" || status === "DISABLED")
    return "destructive" as const;
  return "secondary" as const;
}

export default async function OrganizationDetailPage({ params }: PageProps) {
  const { id } = await params;

  let org;
  try {
    org = await organizationService.getOrganization(id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <Link href="/platform/companies">
          <Button variant="link" className="px-0 h-auto text-sm">
            ← Organizations
          </Button>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight">{org.name}</h2>
          <Badge variant={statusVariant(org.status)}>{org.status}</Badge>
        </div>
        <p className="text-muted-foreground font-mono text-sm">{org.slug}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>Organization profile and usage</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <p className="text-muted-foreground">Legal name</p>
              <p className="font-medium">{org.legalName || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Website</p>
              <p className="font-medium">{org.website || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Timezone</p>
              <p className="font-medium">{org.timezone}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Currency</p>
              <p className="font-medium">{org.defaultCurrency}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="font-medium">
                {format(org.createdAt, "MMM d, yyyy")}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Counts</p>
              <p className="font-medium">
                {org.members.length} members · {org._count.leads} leads ·{" "}
                {org._count.campaigns} campaigns
              </p>
            </div>
          </CardContent>
        </Card>

        <OrganizationActions organizationId={org.id} status={org.status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Members ({org.members.length})</CardTitle>
          <CardDescription>
            Active and disabled memberships for this organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {org.members.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No members yet.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Membership</TableHead>
                    <TableHead>Primary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {org.members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.user.firstName} {member.user.lastName}
                      </TableCell>
                      <TableCell>{member.user.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{member.role.name}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(member.status)}>
                          {member.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {member.isPrimaryAdmin ? (
                          <Badge>Primary</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
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

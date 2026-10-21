import { appOps } from "@/lib/app-paths";
import Link from "next/link";
import { notFound } from "next/navigation";
import { organizationService } from "@/services/organization.service";
import { OrganizationActions } from "@/components/platform/organization-actions";
import { TenantLifecycleActions } from "@/components/platform/tenant-lifecycle-actions";
import { TenantOverridesClient } from "@/components/platform/tenant-overrides-client";
import { TenantBillingTab } from "@/components/platform/tenant-billing-tab";
import { TenantEmailActivityTab } from "@/components/platform/tenant-email-activity-tab";
import { getCurrentUser } from "@/lib/auth/session";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPlatformDate } from "@/lib/platform/format";
import { platformStatusBadge } from "@/lib/platform/status-badge";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrganizationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getCurrentUser();
  const canWrite =
    user?.platformRole === "SUPER_ADMIN" || !!user?.isPlatformAdmin;

  let org;
  try {
    org = await organizationService.getOrganization(id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const statusBadge = platformStatusBadge(org.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <Link href={appOps("/companies")}>
          <Button variant="link" className="h-auto px-0 text-sm">
            ← Organizations
          </Button>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight">{org.name}</h2>
          <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
        </div>
        <p className="font-mono text-sm text-muted-foreground">{org.slug}</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">
            Members ({org.members.length})
          </TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="overrides">Overrides</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <CardDescription>Organization profile and usage</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
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
                  {formatPlatformDate(org.createdAt)}
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
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Members</CardTitle>
              <CardDescription>
                Active and disabled memberships for this organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              {org.members.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
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
                      {org.members.map((member) => {
                        const mb = platformStatusBadge(member.status);
                        return (
                          <TableRow key={member.id}>
                            <TableCell className="font-medium">
                              {member.user.firstName} {member.user.lastName}
                            </TableCell>
                            <TableCell>{member.user.email}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {member.role.name}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={mb.variant}>{mb.label}</Badge>
                            </TableCell>
                            <TableCell>
                              {member.isPrimaryAdmin ? (
                                <Badge>Primary</Badge>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  —
                                </span>
                              )}
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
        </TabsContent>

        <TabsContent value="billing" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Billing</CardTitle>
              <CardDescription>
                Subscription, Paddle IDs, transactions, invoices, credits
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TenantBillingTab
                organizationId={org.id}
                canWrite={canWrite}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <TenantEmailActivityTab organizationId={org.id} />
        </TabsContent>

        <TabsContent value="overrides" className="mt-4">
          <TenantOverridesClient
            organizationId={org.id}
            canWrite={canWrite}
          />
        </TabsContent>

        <TabsContent value="actions" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <OrganizationActions
              organizationId={org.id}
              status={org.status}
            />
            <TenantLifecycleActions
              organizationId={org.id}
              billingProvider={org.billingProvider ?? "DEFAULT"}
              billingEmail={org.billingEmail}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

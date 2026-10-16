import { appHome } from "@/lib/app-paths";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { outreachSequenceService } from "@/services/outreach-sequence.service";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAnyOrgPermission, hasOrgPermission } from "@/lib/tenant/scope";
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

export default async function SequencesPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect(appHome());
  if (
    !hasAnyOrgPermission(user, ["sequences.view", "sequences.manage"])
  ) {
    redirect(appHome());
  }

  const canManage = hasOrgPermission(user, "sequences.manage");
  const sequences = await outreachSequenceService.list(user.organizationId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sequences</h2>
          <p className="text-muted-foreground">
            Build and activate outreach sequences for Contact / Opportunity
            enrollments
            {user.organizationName ? ` · ${user.organizationName}` : ""}.
          </p>
        </div>
        {canManage ? (
          <Link href={appHome("/sequences/new")}>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New sequence
            </Button>
          </Link>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Steps</TableHead>
              <TableHead>Enrollments</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sequences.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-24 text-center text-muted-foreground"
                >
                  {canManage ? (
                    <>
                      No sequences yet —{" "}
                      <Link
                        href={appHome("/sequences/new")}
                        className="underline"
                      >
                        create one
                      </Link>
                    </>
                  ) : (
                    "No sequences yet"
                  )}
                </TableCell>
              </TableRow>
            ) : (
              sequences.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link
                      href={appHome(`/sequences/${s.id}`)}
                      className="font-medium hover:underline"
                    >
                      {s.name}
                    </Link>
                    {s.description ? (
                      <div className="text-xs text-muted-foreground">
                        {s.description}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{s.status}</Badge>
                  </TableCell>
                  <TableCell>{s.steps.length}</TableCell>
                  <TableCell>{s._count.enrollments}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

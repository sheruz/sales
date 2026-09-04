import Link from "next/link";
import { redirect } from "next/navigation";
import { outreachSequenceService } from "@/services/outreach-sequence.service";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAnyOrgPermission } from "@/lib/tenant/scope";
import { Badge } from "@/components/ui/badge";
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
  if (!user?.organizationId) redirect("/dashboard");
  if (
    !hasAnyOrgPermission(user, ["sequences.view", "sequences.manage"])
  ) {
    redirect("/dashboard");
  }

  const sequences = await outreachSequenceService.list(user.organizationId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Sequences</h2>
        <p className="text-muted-foreground">
          Reusable outreach sequences for Opportunity/Contact enrollments
          {user.organizationName ? ` · ${user.organizationName}` : ""}.
        </p>
      </div>

      <div className="rounded-md border">
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
                  No sequences yet — create via API or seed
                </TableCell>
              </TableRow>
            ) : (
              sequences.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/sequences/${s.id}`}
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

import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Pencil, Mail, Phone, Building2, MapPin, ExternalLink } from "lucide-react";
import { leadService } from "@/services/lead.service";
import { getCurrentUser } from "@/lib/auth/session";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { LeadDetailTabs } from "@/components/leads/lead-detail-tabs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LeadDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) notFound();

  const { id } = await params;

  let lead;
  try {
    lead = await leadService.getById(id);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">{lead.fullName}</h2>
            <LeadStatusBadge status={lead.status} />
          </div>
          <p className="text-muted-foreground">
            {lead.jobTitle}
            {lead.companyName ? ` at ${lead.companyName}` : ""}
          </p>
        </div>
        <Link href={`/dashboard/leads/${id}/edit`}>
          <Button variant="outline" size="sm">
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {lead.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${lead.email}`} className="hover:underline">
                    {lead.email}
                  </a>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{lead.phone}</span>
                </div>
              )}
              {lead.linkedInUrl && (
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={lead.linkedInUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline truncate"
                  >
                    LinkedIn Profile
                  </a>
                </div>
              )}
              {(lead.city || lead.country) && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{[lead.city, lead.country].filter(Boolean).join(", ")}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Company</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {lead.companyName && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>{lead.companyName}</span>
                </div>
              )}
              {lead.industry && (
                <p className="text-muted-foreground">Industry: {lead.industry}</p>
              )}
              {lead.companySize && (
                <p className="text-muted-foreground">Size: {lead.companySize}</p>
              )}
              {lead.companyWebsite && (
                <a
                  href={lead.companyWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {lead.companyWebsite}
                </a>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Score</span>
                <span className="font-medium">{lead.score}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source</span>
                <span>{lead.source ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Assigned</span>
                <span>
                  {lead.assignedTo
                    ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}`
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{format(new Date(lead.createdAt), "MMM d, yyyy")}</span>
              </div>
              {lead.estimatedBudget && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Est. Budget</span>
                  <span>${Number(lead.estimatedBudget).toLocaleString()}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <LeadDetailTabs
            leadId={lead.id}
            initialNotes={lead.leadNotes.map((n) => ({
              ...n,
              createdAt: n.createdAt.toISOString(),
            }))}
            initialTasks={lead.tasks.map((t) => ({
              ...t,
              dueDate: t.dueDate?.toISOString() ?? null,
            }))}
            initialActivities={lead.activities.map((a) => ({
              ...a,
              createdAt: a.createdAt.toISOString(),
            }))}
          />
        </div>
      </div>
    </div>
  );
}

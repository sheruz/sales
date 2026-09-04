import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Building2, Mail, Phone, ExternalLink } from "lucide-react";
import { contactService } from "@/services/contact.service";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAnyOrgPermission } from "@/lib/tenant/scope";
import { SequenceEnrollmentPanel } from "@/components/sequences/sequence-enrollment-panel";
import { sequenceEnrollmentService } from "@/services/sequence-enrollment.service";
import { outreachSequenceService } from "@/services/outreach-sequence.service";
import { campaignService } from "@/services/campaign.service";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContactDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user?.organizationId) notFound();
  if (!hasAnyOrgPermission(user, ["opportunities.view", "leads.view"])) {
    notFound();
  }

  const { id } = await params;
  let contact;
  try {
    contact = await contactService.getById(user.organizationId, id);
  } catch {
    notFound();
  }

  const [enrollmentResult, sequences, campaigns] = await Promise.all([
    sequenceEnrollmentService.list(user.organizationId, {
      contactId: contact.id,
      limit: 20,
    }),
    outreachSequenceService.list(user.organizationId).catch(() => []),
    campaignService.list(user.organizationId).catch(() => []),
  ]);

  const canManageEnrollments = hasAnyOrgPermission(user, [
    "sequences.manage",
    "campaigns.manage",
    "opportunities.update",
  ]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight">
            {contact.fullName}
          </h2>
          <Badge variant="secondary">{contact.status}</Badge>
        </div>
        <p className="text-muted-foreground">
          {contact.title || "Contact"}
          {contact.company ? ` at ${contact.company.name}` : ""}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Contact info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {contact.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${contact.email}`} className="hover:underline">
                  {contact.email}
                </a>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{contact.phone}</span>
              </div>
            )}
            {contact.linkedInUrl && (
              <div className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                <a
                  href={contact.linkedInUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  LinkedIn
                </a>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Link
                href={`/dashboard/companies/${contact.company.id}`}
                className="hover:underline"
              >
                {contact.company.name}
              </Link>
            </div>
            {contact.lead && (
              <p className="pt-2 text-xs text-muted-foreground">
                Legacy lead bridge:{" "}
                <Link
                  href={`/dashboard/leads/${contact.lead.id}`}
                  className="hover:underline"
                >
                  {contact.lead.fullName}
                </Link>
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Opportunities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {contact.primaryOpportunities.length === 0 ? (
                <p className="text-muted-foreground">No opportunities</p>
              ) : (
                contact.primaryOpportunities.map((o) => (
                  <Link
                    key={o.id}
                    href={`/dashboard/opportunities/${o.id}`}
                    className="flex justify-between hover:underline"
                  >
                    <span>
                      {o.stage}
                      {o.primarySignal ? ` · ${o.primarySignal.title}` : ""}
                    </span>
                    <span className="text-muted-foreground">
                      {format(o.updatedAt, "MMM d")}
                    </span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conversations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {contact.inboxConversations.length === 0 ? (
                <p className="text-muted-foreground">No conversations</p>
              ) : (
                contact.inboxConversations.map((c) => (
                  <div key={c.id} className="flex justify-between">
                    <span className="truncate">
                      {c.subject || c.status || c.id.slice(0, 8)}
                    </span>
                    <span className="text-muted-foreground">
                      {c.lastMessageAt
                        ? format(c.lastMessageAt, "MMM d")
                        : ""}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Meetings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {contact.meetings.length === 0 ? (
                <p className="text-muted-foreground">No meetings</p>
              ) : (
                contact.meetings.map((m) => (
                  <div key={m.id} className="flex justify-between">
                    <span>{m.title || m.outcome}</span>
                    <span className="text-muted-foreground">
                      {format(m.date, "MMM d, yyyy")}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <SequenceEnrollmentPanel
        contactId={contact.id}
        sequences={sequences.map((s) => ({
          id: s.id,
          name: s.name,
          status: s.status,
        }))}
        campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))}
        enrollments={enrollmentResult.items.map((e) => ({
          id: e.id,
          status: e.status,
          currentStepOrder: e.currentStepOrder,
          nextRunAt: e.nextRunAt?.toISOString() ?? null,
          stopReason: e.stopReason,
          sequence: e.sequence,
          contact: e.contact,
          campaign: e.campaign,
        }))}
        canManage={canManageEnrollments}
      />
    </div>
  );
}

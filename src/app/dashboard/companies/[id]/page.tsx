import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Building2, ExternalLink, Globe } from "lucide-react";
import { companyService } from "@/services/company.service";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAnyOrgPermission } from "@/lib/tenant/scope";
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

export default async function CompanyDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user?.organizationId) notFound();
  if (!hasAnyOrgPermission(user, ["opportunities.view", "leads.view"])) {
    notFound();
  }

  const { id } = await params;
  let company;
  try {
    company = await companyService.getById(user.organizationId, id);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight">{company.name}</h2>
          <Badge variant="secondary">{company.status}</Badge>
        </div>
        <p className="text-muted-foreground">
          {company.industry || "Company"}
          {company.domain ? ` · ${company.domain}` : ""}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Company info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {company.domain && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span>{company.domain}</span>
              </div>
            )}
            {company.website && (
              <div className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                <a
                  href={company.website}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  Website
                </a>
              </div>
            )}
            {(company.city || company.country) && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>
                  {[company.city, company.country].filter(Boolean).join(", ")}
                </span>
              </div>
            )}
            {company.description && (
              <p className="text-muted-foreground">{company.description}</p>
            )}
            <div className="grid grid-cols-2 gap-2 pt-2 text-xs text-muted-foreground">
              <div>Contacts: {company._count.contacts}</div>
              <div>Signals: {company._count.signals}</div>
              <div>Opportunities: {company._count.opportunities}</div>
              <div>Deals: {company._count.deals}</div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contacts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {company.contacts.length === 0 ? (
                <p className="text-muted-foreground">No contacts yet</p>
              ) : (
                company.contacts.map((c) => (
                  <Link
                    key={c.id}
                    href={`/dashboard/contacts/${c.id}`}
                    className="flex justify-between hover:underline"
                  >
                    <span>{c.fullName}</span>
                    <span className="text-muted-foreground">
                      {c.title || c.email || ""}
                    </span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Signals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {company.signals.length === 0 ? (
                <p className="text-muted-foreground">No signals yet</p>
              ) : (
                company.signals.map((s) => (
                  <div key={s.id} className="flex justify-between gap-4">
                    <span className="truncate">{s.title}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {format(s.detectedAt, "MMM d, yyyy")}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Opportunities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {company.opportunities.length === 0 ? (
                <p className="text-muted-foreground">No opportunities yet</p>
              ) : (
                company.opportunities.map((o) => (
                  <Link
                    key={o.id}
                    href={`/dashboard/opportunities/${o.id}`}
                    className="flex justify-between hover:underline"
                  >
                    <span>
                      {o.stage}
                      {o.primaryContact
                        ? ` · ${o.primaryContact.fullName}`
                        : ""}
                    </span>
                    <span className="text-muted-foreground">
                      {format(o.updatedAt, "MMM d")}
                    </span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Conversations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {company.inboxConversations.length === 0 ? (
                  <p className="text-muted-foreground">None</p>
                ) : (
                  company.inboxConversations.map((c) => (
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
                <CardTitle className="text-base">Deals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {company.deals.length === 0 ? (
                  <p className="text-muted-foreground">None</p>
                ) : (
                  company.deals.map((d) => (
                    <div key={d.id} className="flex justify-between">
                      <span>{d.name || d.stage}</span>
                      <span className="text-muted-foreground">{d.stage}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import { leadService } from "@/services/lead.service";
import { getCurrentUser } from "@/lib/auth/session";
import { LeadForm } from "@/components/leads/lead-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeadStatus } from "@prisma/client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditLeadPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user?.organizationId) notFound();

  const { id } = await params;

  let lead;
  try {
    lead = await leadService.getById(user.organizationId, id);
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Edit Lead</h2>
        <p className="text-muted-foreground">{lead.fullName}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Lead Information</CardTitle>
        </CardHeader>
        <CardContent>
          <LeadForm
            leadId={lead.id}
            initialData={{
              firstName: lead.firstName,
              lastName: lead.lastName,
              email: lead.email ?? "",
              phone: lead.phone ?? "",
              linkedInUrl: lead.linkedInUrl ?? "",
              companyName: lead.companyName ?? "",
              companyWebsite: lead.companyWebsite ?? "",
              jobTitle: lead.jobTitle ?? "",
              country: lead.country ?? "",
              city: lead.city ?? "",
              industry: lead.industry ?? "",
              companySize: lead.companySize ?? "",
              source: lead.source ?? "Manual",
              status: lead.status as LeadStatus,
              notes: lead.notes ?? "",
              estimatedBudget: lead.estimatedBudget
                ? String(lead.estimatedBudget)
                : "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

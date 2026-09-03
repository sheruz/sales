import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { businessBrainService } from "@/services/business-brain.service";
import { BusinessBrainClient } from "@/components/business-brain/business-brain-client";

export default async function BusinessBrainPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/dashboard");

  const [profile, documents] = await Promise.all([
    businessBrainService.getProfile(user.organizationId),
    businessBrainService.listDocuments(user.organizationId),
  ]);

  const serializedProfile = profile
    ? {
        companyName: profile.companyName,
        description: profile.description,
        website: profile.website,
        industry: profile.industry,
        locations: profile.locations,
        targetMarkets: profile.targetMarkets,
        companySize: profile.companySize,
        yearsInBusiness: profile.yearsInBusiness,
        positioning: profile.positioning,
        valueProposition: profile.valueProposition,
        competitiveAdvantages: profile.competitiveAdvantages,
      }
    : null;

  const serializedDocs = documents.map(
    (d: {
      id: string;
      type: string;
      title: string;
      content: string;
      status: string;
      createdAt: Date;
    }) => ({
      id: d.id,
      type: d.type,
      title: d.title,
      content: d.content,
      status: d.status,
      createdAt: d.createdAt.toISOString(),
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Business Brain</h2>
        <p className="text-muted-foreground">
          Company profile and knowledge documents used by AI for sales context.
        </p>
      </div>
      <BusinessBrainClient
        initialProfile={serializedProfile}
        initialDocuments={serializedDocs}
      />
    </div>
  );
}

import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { HotLeadsClient } from "@/components/pow/hot-leads-client";

export default async function HotLeadsPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/login");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Hot leads</h1>
        <p className="text-sm text-muted-foreground">
          Prospects who opened a Proof of Work preview page (human visits only).
        </p>
      </div>
      <HotLeadsClient />
    </div>
  );
}

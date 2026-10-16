import { appHome } from "@/lib/app-paths";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { hasOrgPermission } from "@/lib/tenant/scope";
import { SequenceBuilder } from "@/components/sequences/sequence-builder";
import { Button } from "@/components/ui/button";

export default async function NewSequencePage() {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect(appHome());
  if (!hasOrgPermission(user, "sequences.manage")) {
    redirect(appHome("/sequences"));
  }

  return (
    <div className="space-y-6">
      <Link href={appHome("/sequences")}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </Link>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Sequence Builder</h2>
        <p className="text-muted-foreground">
          Create a draft outreach sequence. Activate when ready to enroll.
        </p>
      </div>
      <SequenceBuilder canManage />
    </div>
  );
}

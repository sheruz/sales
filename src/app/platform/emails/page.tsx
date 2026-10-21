import { getCurrentUser } from "@/lib/auth/session";
import { EmailTemplatesClient } from "@/components/platform/email-templates-client";

export default async function PlatformEmailsPage() {
  const user = await getCurrentUser();
  const canWrite =
    user?.platformRole === "SUPER_ADMIN" || !!user?.isPlatformAdmin;

  return (
    <EmailTemplatesClient
      canWrite={canWrite}
      actorEmail={user?.email || ""}
    />
  );
}

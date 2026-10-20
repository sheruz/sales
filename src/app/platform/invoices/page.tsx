import { getCurrentUser } from "@/lib/auth/session";
import { InvoicesAdminClient } from "@/components/platform/invoices-admin-client";

export default async function InvoicesPage() {
  const user = await getCurrentUser();
  const canWrite =
    user?.platformRole === "SUPER_ADMIN" || !!user?.isPlatformAdmin;
  return <InvoicesAdminClient canWrite={canWrite} />;
}

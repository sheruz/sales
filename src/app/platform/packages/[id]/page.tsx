import { getCurrentUser } from "@/lib/auth/session";
import { PackageEditorClient } from "@/components/platform/package-editor-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PackageDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getCurrentUser();
  const canWrite = user?.platformRole === "SUPER_ADMIN" || !!user?.isPlatformAdmin;
  return <PackageEditorClient planId={id} canWrite={canWrite} />;
}

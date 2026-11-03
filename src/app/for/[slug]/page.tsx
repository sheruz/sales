import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { powPreviewPageService } from "@/services/pow-preview-page.service";
import { PowPreviewPageClient } from "@/components/pow/preview-page-client";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: "Website notes",
    robots: { index: false, follow: false, nocache: true },
  };
}

export default async function PowForPreviewPage({ params }: Props) {
  const { slug } = await params;
  const view = await powPreviewPageService.getPublicView(
    decodeURIComponent(slug)
  );
  if (!view) notFound();

  return <PowPreviewPageClient initial={view} />;
}

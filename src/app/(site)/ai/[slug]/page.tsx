import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServicePageView } from "@/components/marketing/service-page-view";
import { aiPages, getAiPage } from "@/content/pages";
import { buildPageMetadata } from "@/lib/marketing/page-metadata";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return aiPages.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getAiPage(slug);
  if (!page) return {};
  return buildPageMetadata({
    title: page.seoTitle,
    description: page.seoDescription,
    path: `/ai/${page.slug}`,
  });
}

export default async function AiDetailPage({ params }: Props) {
  const { slug } = await params;
  const page = getAiPage(slug);
  if (!page) notFound();
  return (
    <ServicePageView
      page={page}
      basePath="/ai"
      sectionLabel="AI"
      eyebrow="AI service"
    />
  );
}

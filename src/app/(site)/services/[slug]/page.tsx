import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServicePageView } from "@/components/marketing/service-page-view";
import { getServicePage, servicePages } from "@/content/pages";
import { buildPageMetadata } from "@/lib/marketing/page-metadata";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return servicePages.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getServicePage(slug);
  if (!page) return {};
  return buildPageMetadata({
    title: page.seoTitle,
    description: page.seoDescription,
    path: `/services/${page.slug}`,
  });
}

export default async function ServiceDetailPage({ params }: Props) {
  const { slug } = await params;
  const page = getServicePage(slug);
  if (!page) notFound();
  return (
    <ServicePageView
      page={page}
      basePath="/services"
      sectionLabel="Services"
      eyebrow="Service"
    />
  );
}

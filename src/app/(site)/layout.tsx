import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { MetaPixel } from "@/components/marketing/meta-pixel";
import { getMetaPixelId } from "@/lib/marketing/meta-pixel-id";
import { siteConfig } from "@/content/site";
import "../marketing.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-mkt-display",
  display: "swap",
});

const body = Figtree({
  subsets: ["latin"],
  variable: "--font-mkt-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — Custom software for growing businesses`,
    template: `%s · ${siteConfig.name}`,
  },
  description:
    "Delvix Studio builds web apps, mobile apps, custom ERP/CRM, AI integrations and automation. Fixed scope. Weekly demos. You own the code.",
  openGraph: {
    type: "website",
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.tagline,
  },
  alternates: { canonical: siteConfig.url },
};

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pixelId = await getMetaPixelId();

  return (
    <div className={`mkt ${display.variable} ${body.variable}`}>
      <MetaPixel pixelId={pixelId} />
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </div>
  );
}

import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { MetaPixel } from "@/components/marketing/meta-pixel";
import { getMetaPixelId } from "@/lib/marketing/meta-pixel-id";
import { siteConfig } from "@/content/site";
import "../marketing.css";

const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-mkt-display",
  display: "swap",
  preload: true,
});

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mkt-body",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — Custom software for growing businesses`,
    template: `%s · ${siteConfig.name}`,
  },
  description:
    "Delvix Studio builds web apps, mobile apps, custom ERP/CRM, AI integrations and automation. Fixed scope. Weekly demos. You own the code.",
  icons: {
    icon: [{ url: siteConfig.icon, type: "image/svg+xml" }],
    apple: [{ url: "/delvix-icon-dark.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    type: "website",
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.tagline,
    images: [{ url: siteConfig.logoOnDark }],
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

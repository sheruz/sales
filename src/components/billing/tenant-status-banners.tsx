import Link from "next/link";
import { appHome } from "@/lib/app-paths";
import {
  resolveTenantBanners,
  type TenantBanner,
} from "@/lib/billing/tenant-banner-state";

function toneClasses(tone: TenantBanner["tone"]) {
  if (tone === "danger") {
    return "border-red-300 bg-red-50 text-red-950";
  }
  if (tone === "warn") {
    return "border-amber-300 bg-amber-50 text-amber-950";
  }
  return "border-sky-300 bg-sky-50 text-sky-950";
}

export async function TenantStatusBanners({
  organizationId,
}: {
  organizationId: string;
}) {
  const banner = await resolveTenantBanners(organizationId);
  if (!banner) return null;

  return (
    <div
      className={`border-b px-4 py-2.5 text-sm ${toneClasses(banner.tone)}`}
      role="status"
      data-banner-kind={banner.kind}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="font-semibold">{banner.title}</span>
          <span className="mx-1.5 text-current/40">·</span>
          <span>{banner.body}</span>
        </div>
        <Link
          href={appHome(banner.ctaHref)}
          className="shrink-0 underline font-medium whitespace-nowrap"
        >
          {banner.ctaLabel}
        </Link>
      </div>
    </div>
  );
}

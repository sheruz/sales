import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/content/site";

type Props = {
  variant?: "onDark" | "onLight";
  className?: string;
  height?: number;
};

/** Readable wordmark: icon mark + "Delvix Studio" text (avoids tiny SVG "STUDIO"). */
export function SiteLogo({
  variant = "onDark",
  className = "",
  height = 36,
}: Props) {
  const icon =
    variant === "onLight" ? "/delvix-icon-light.svg" : "/delvix-icon-dark.svg";
  const ink = variant === "onLight" ? "text-[var(--mkt-light-ink)]" : "text-[var(--mkt-ink)]";

  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2.5 ${className}`}
      aria-label={`${siteConfig.name} home`}
    >
      <Image
        src={icon}
        alt=""
        width={height}
        height={height}
        className="h-9 w-9 shrink-0"
        priority
        unoptimized
      />
      <span
        className={`text-[1.125rem] font-semibold tracking-tight sm:text-[1.2rem] ${ink}`}
        style={{ fontFamily: "var(--font-mkt-display), system-ui, sans-serif" }}
      >
        Delvix Studio
      </span>
    </Link>
  );
}

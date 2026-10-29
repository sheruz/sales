import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/content/site";

type Props = {
  /** Marketing chrome is dark — default on-dark wordmark */
  variant?: "onDark" | "onLight";
  className?: string;
  /** Prefer compact height in header */
  height?: number;
};

export function SiteLogo({
  variant = "onDark",
  className = "",
  height = 28,
}: Props) {
  const src =
    variant === "onLight" ? siteConfig.logoOnLight : siteConfig.logoOnDark;
  const width = Math.round((height * 379) / 96);

  return (
    <Link
      href="/"
      className={`inline-flex items-center ${className}`}
      aria-label={`${siteConfig.name} home`}
    >
      <Image
        src={src}
        alt={siteConfig.name}
        width={width}
        height={height}
        className="h-[1.75rem] w-auto sm:h-8"
        priority
        unoptimized
      />
    </Link>
  );
}

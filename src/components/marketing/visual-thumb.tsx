import Image from "next/image";
import {
  illustrationAlt,
  illustrationSrc,
  type PageVisualKey,
} from "@/lib/marketing/page-visuals";

type Props = {
  visual: PageVisualKey;
  alt?: string;
  className?: string;
  /** Wider crop for mega-menu / cards */
  aspect?: "video" | "wide" | "square";
};

/** Compact illustration for listing cards and mega-menu highlights. */
export function VisualThumb({
  visual,
  alt,
  className = "",
  aspect = "video",
}: Props) {
  const ratio =
    aspect === "square"
      ? "aspect-square"
      : aspect === "wide"
        ? "aspect-[2/1]"
        : "aspect-video";

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-[var(--mkt-line)] bg-[#0a0f1a] ${ratio} ${className}`}
    >
      <Image
        src={illustrationSrc(visual)}
        alt={illustrationAlt(visual, alt)}
        fill
        className="object-cover object-top"
        sizes="(max-width: 768px) 100vw, 400px"
        unoptimized
      />
    </div>
  );
}

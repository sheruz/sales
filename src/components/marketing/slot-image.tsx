import Image from "next/image";
import { resolveSlotSrc } from "@/lib/marketing/slot-images";

type Props = {
  slot: string;
  alt: string;
  /** Intrinsic / layout size hints */
  width?: number;
  height?: number;
  fill?: boolean;
  /** CSS aspect ratio (e.g. "16/10") */
  aspectRatio?: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  sizes?: string;
  /** Overlay label shown only on navy placeholder */
  note?: string;
};

/**
 * Maps a canvas slot ID (e.g. HOME-01) to /public/marketing/{id}.webp.
 * Missing files render a neutral navy box — never a random stock image.
 */
export function SlotImage({
  slot,
  alt,
  width = 1600,
  height = 1000,
  fill,
  aspectRatio,
  className = "",
  imgClassName = "",
  priority,
  sizes,
  note,
}: Props) {
  const src = resolveSlotSrc(slot);
  const ratio = aspectRatio ?? `${width} / ${height}`;

  if (!src) {
    return (
      <div
        className={`mkt-slot-ph ${className}`.trim()}
        style={fill ? undefined : { aspectRatio: ratio }}
        role="img"
        aria-label={alt}
      >
        <span className="mkt-slot-ph__id">{slot}</span>
        {note ? <span className="mkt-slot-ph__note">{note}</span> : null}
      </div>
    );
  }

  if (fill) {
    return (
      <div className={`relative overflow-hidden ${className}`.trim()}>
        <Image
          src={src}
          alt={alt}
          fill
          className={`object-cover ${imgClassName}`.trim()}
          sizes={sizes ?? "100vw"}
          priority={priority}
        />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={`${className} ${imgClassName}`.trim()}
      sizes={sizes}
      priority={priority}
    />
  );
}

import Image from "next/image";

function isSvg(src: string) {
  return /\.svg(?:$|\?)/i.test(src);
}

export function BrowserFrame({
  src,
  alt,
  className = "",
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  /** Set true for above-the-fold hero screenshots (avoids lazy LCP). */
  priority?: boolean;
}) {
  return (
    <div className={`mkt-browser relative z-[1] ${className}`}>
      <div className="mkt-browser__bar" aria-hidden>
        <span className="mkt-browser__dot" />
        <span className="mkt-browser__dot" />
        <span className="mkt-browser__dot" />
      </div>
      <div className="relative aspect-[16/10] bg-[#0a0f1a]">
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover object-top"
          sizes="(max-width: 768px) 100vw, 720px"
          priority={priority}
          fetchPriority={priority ? "high" : "auto"}
          /* Local marketing SVGs must skip the optimizer (Next blocks SVG by default). */
          unoptimized={isSvg(src)}
        />
      </div>
    </div>
  );
}

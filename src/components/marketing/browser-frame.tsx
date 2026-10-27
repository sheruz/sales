import Image from "next/image";

export function BrowserFrame({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
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
          priority={false}
        />
      </div>
    </div>
  );
}

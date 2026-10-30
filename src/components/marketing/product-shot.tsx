import { BrowserFrame } from "@/components/marketing/browser-frame";
import {
  resolveProductShot,
  type ProductShotName,
} from "@/lib/marketing/product-shots";

type Props = {
  name: ProductShotName;
  alt: string;
  className?: string;
  priority?: boolean;
  /** Soft brand glow + slight lift for hero use */
  hero?: boolean;
};

/**
 * Real product screenshot when a PNG exists under /public/marketing/screens/,
 * otherwise a finished SVG product mockup with UI chrome.
 */
export function ProductShot({
  name,
  alt,
  className = "",
  priority = false,
  hero = false,
}: Props) {
  const { src } = resolveProductShot(name);

  return (
    <div
      className={`relative ${hero ? "mkt-product-shot--hero" : ""} ${className}`}
    >
      {hero ? <div className="mkt-glow mkt-product-shot__glow" aria-hidden /> : null}
      <BrowserFrame src={src} alt={alt} priority={priority} />
    </div>
  );
}

import { BrowserFrame } from "@/components/marketing/browser-frame";
import {
  illustrationAlt,
  illustrationSrc,
  type PageVisualKey,
} from "@/lib/marketing/page-visuals";

type Props = {
  visual: PageVisualKey;
  /** Override default alt text */
  alt?: string;
  className?: string;
  priority?: boolean;
};

/** Browser-framed product mockup used in marketing heroes and mid-page sections. */
export function PageVisual({
  visual,
  alt,
  className = "",
  priority = false,
}: Props) {
  return (
    <BrowserFrame
      src={illustrationSrc(visual)}
      alt={illustrationAlt(visual, alt)}
      className={className}
      priority={priority}
    />
  );
}

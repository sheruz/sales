import {
  Bricolage_Grotesque,
  Figtree,
  IBM_Plex_Mono,
} from "next/font/google";
import { DelvixLanding } from "@/components/landing/delvix-landing";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export default function HomePage() {
  return (
    <div
      className={`${bricolage.variable} ${figtree.variable} ${ibmPlexMono.variable}`}
    >
      <DelvixLanding />
    </div>
  );
}

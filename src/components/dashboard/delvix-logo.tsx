"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/** 30px Delvix mark — light icon on dark bg, dark icon on light bg. */
export function DelvixLogoMark({ size = 30 }: { size?: number }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dark = !mounted || resolvedTheme !== "light";
  const src = dark
    ? "/branding/delvix-icon-light-96.png"
    : "/branding/delvix-icon-dark-96.png";

  return (
    <Image
      src={src}
      alt="Delvix"
      width={size}
      height={size}
      className="rounded-lg"
      priority
    />
  );
}

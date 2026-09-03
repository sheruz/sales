import { redirect } from "next/navigation";

/** Legacy path — Super Admin console lives at /platform */
export default function LegacyPlatformPage() {
  redirect("/platform");
}

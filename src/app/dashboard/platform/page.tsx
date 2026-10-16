import { appOps } from "@/lib/app-paths";
import { redirect } from "next/navigation";

/** Internal redirect — Super Admin console lives at APP_OPS_BASE */
export default function LegacyPlatformPage() {
  redirect(appOps());
}

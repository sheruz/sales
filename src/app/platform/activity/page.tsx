import { redirect } from "next/navigation";
import { appOps } from "@/lib/app-paths";

/** B4b: Activity merged into Dashboard (#activity). */
export default function PlatformActivityRedirect() {
  redirect(`${appOps()}#activity`);
}

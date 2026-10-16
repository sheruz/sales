import { appHome } from "@/lib/app-paths";
import { redirect } from "next/navigation";

export default function OpportunitiesRedirectPage() {
  redirect(appHome("/opportunities"));
}

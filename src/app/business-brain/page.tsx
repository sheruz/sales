import { appHome } from "@/lib/app-paths";
import { redirect } from "next/navigation";

export default function BusinessBrainRedirect() {
  redirect(appHome("/business-brain"));
}

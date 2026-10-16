import { appHome } from "@/lib/app-paths";
import { redirect } from "next/navigation";

export default function SourcesRedirect() {
  redirect(appHome("/sources"));
}

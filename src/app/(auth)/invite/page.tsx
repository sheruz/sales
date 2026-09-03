import { Suspense } from "react";
import InviteAcceptForm from "./invite-form";

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          Loading...
        </div>
      }
    >
      <InviteAcceptForm />
    </Suspense>
  );
}

import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="text-muted-foreground text-sm">
        Last updated: {new Date().toISOString().slice(0, 10)}
      </p>
      <div className="space-y-4 text-sm leading-relaxed">
        <p>
          By creating an account you agree to use the platform lawfully, respect
          recipient consent for outreach, and keep API keys and OAuth credentials
          confidential.
        </p>
        <p>
          The autonomous revenue agent requires human approval for outbound,
          campaigns, proposals, and other high-risk actions. You remain
          responsible for approved actions and for complying with email and
          advertising regulations in your jurisdictions.
        </p>
        <p>
          Billing is governed by your selected plan and Stripe subscription
          terms when enabled. See also our{" "}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

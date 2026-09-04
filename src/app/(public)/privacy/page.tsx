import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="text-muted-foreground text-sm">
        Last updated: {new Date().toISOString().slice(0, 10)}
      </p>
      <div className="prose prose-sm dark:prose-invert space-y-4 text-sm leading-relaxed">
        <p>
          We process account, organization, CRM, email, and usage data to operate
          the Sales Platform for your company. Data is scoped to your
          organization and is not shared across tenants.
        </p>
        <p>
          You may request an export or deletion of organization data from an
          organization administrator via Settings / Privacy APIs
          (<code>/api/privacy/data</code>).
        </p>
        <p>
          Email outreach respects unsubscribe, suppression, bounce, and complaint
          signals. AI features treat external content as untrusted data and do
          not use your data to train third-party foundation models through this
          application layer (provider policies may apply to BYOK keys).
        </p>
        <p>
          Contact your workspace administrator for privacy requests. For product
          questions, return to the{" "}
          <Link href="/" className="underline">
            home page
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

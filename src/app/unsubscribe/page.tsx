import { unsubscribeService } from "@/services/unsubscribe.service";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; ok?: string; error?: string; email?: string }>;
}) {
  const params = await searchParams;
  let message = params.error || null;
  let email = params.email || null;
  let ok = params.ok === "1";

  if (params.token && !ok && !message) {
    const result = await unsubscribeService.applyToken(params.token);
    if (result.ok) {
      ok = true;
      email = result.email;
    } else {
      message = result.error;
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Unsubscribe</h1>
      {ok ? (
        <p className="mt-4 text-sm text-muted-foreground">
          You&apos;ve been unsubscribed
          {email ? ` (${email})` : ""}. You won&apos;t receive further outreach
          emails from us.
        </p>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          {message ||
            "Open the unsubscribe link from your email to opt out. No login required."}
        </p>
      )}
    </div>
  );
}

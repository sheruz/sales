import { Resend } from "resend";

export async function sendMarketingNotify(opts: {
  subject: string;
  text: string;
  replyTo?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;
  if (!apiKey || !to) {
    throw new Error("RESEND_API_KEY and NOTIFY_EMAIL must be set");
  }
  const resend = new Resend(apiKey);
  const from =
    process.env.RESEND_FROM_EMAIL ||
    "Delvix Studio <hello@delvixstudio.com>";

  const result = await resend.emails.send({
    from,
    to: [to],
    subject: opts.subject,
    text: opts.text,
    replyTo: opts.replyTo,
  });

  if (result.error) throw new Error(result.error.message);
  return result.data;
}

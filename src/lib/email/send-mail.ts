import nodemailer from "nodemailer";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromName: string;
  fromEmail: string;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmailWithConfig(
  config: SmtpConfig,
  params: SendEmailParams
): Promise<{ messageId: string }> {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
  });

  const info = await transporter.sendMail({
    from: `"${config.fromName}" <${config.fromEmail}>`,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html ?? params.text.replace(/\n/g, "<br>"),
    headers: {
      "List-Unsubscribe": `<mailto:${config.fromEmail}?subject=unsubscribe>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });

  return { messageId: info.messageId };
}

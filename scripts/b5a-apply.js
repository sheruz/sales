/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * B5a apply — EmailSendStatus enum, email_templates, email_send_logs,
 * payment_settings platform email columns, seed lifecycle templates.
 * Requires APPLY=1.
 */
const {
  createPrisma,
  isApply,
  tableExists,
  columnExists,
  enumExists,
  TEMPLATE_KEYS,
} = require("./b5a-lib");

const DEFAULTS = [
  {
    key: "trial_ending_3d",
    name: "Trial ending (3 days)",
    subject: "Your trial ends in 3 days — {{orgName}}",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p>Your trial for <strong>{{orgName}}</strong> ends on <strong>{{trialEndsAt}}</strong> (3 days).</p><p>Choose a plan to keep access.</p>",
    bodyText:
      "Hi {{adminName}},\n\nYour trial for {{orgName}} ends on {{trialEndsAt}} (3 days).\nChoose a plan to keep access.\n\n{{ctaUrl}}",
    variables: ["orgName", "adminName", "trialEndsAt", "ctaUrl", "supportEmail"],
  },
  {
    key: "trial_ending_1d",
    name: "Trial ending (1 day)",
    subject: "Last day of your trial — {{orgName}}",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p>Your trial for <strong>{{orgName}}</strong> ends tomorrow (<strong>{{trialEndsAt}}</strong>).</p><p>Subscribe now to avoid interruption.</p>",
    bodyText:
      "Hi {{adminName}},\n\nYour trial for {{orgName}} ends tomorrow ({{trialEndsAt}}).\nSubscribe now to avoid interruption.\n\n{{ctaUrl}}",
    variables: ["orgName", "adminName", "trialEndsAt", "ctaUrl", "supportEmail"],
  },
  {
    key: "trial_expired",
    name: "Trial expired",
    subject: "Your trial has ended — {{orgName}}",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p>The trial for <strong>{{orgName}}</strong> has ended. Your data is safe — pick a plan to reactivate.</p>",
    bodyText:
      "Hi {{adminName}},\n\nThe trial for {{orgName}} has ended. Your data is safe — pick a plan to reactivate.\n\n{{ctaUrl}}",
    variables: ["orgName", "adminName", "ctaUrl", "supportEmail"],
  },
  {
    key: "payment_failed_0",
    name: "Payment failed (day 0)",
    subject: "Payment failed — action needed for {{orgName}}",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p>We could not charge your payment method for <strong>{{orgName}}</strong>. Please update your card to avoid suspension (grace until <strong>{{graceEndsAt}}</strong>).</p>",
    bodyText:
      "Hi {{adminName}},\n\nWe could not charge your payment method for {{orgName}}. Please update your card to avoid suspension (grace until {{graceEndsAt}}).\n\n{{ctaUrl}}",
    variables: ["orgName", "adminName", "graceEndsAt", "ctaUrl", "supportEmail"],
  },
  {
    key: "payment_failed_3",
    name: "Payment failed (day 3)",
    subject: "Reminder: payment still failed — {{orgName}}",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p>Payment for <strong>{{orgName}}</strong> is still outstanding (day 3). Update your payment method before <strong>{{graceEndsAt}}</strong>.</p>",
    bodyText:
      "Hi {{adminName}},\n\nPayment for {{orgName}} is still outstanding (day 3). Update your payment method before {{graceEndsAt}}.\n\n{{ctaUrl}}",
    variables: ["orgName", "adminName", "graceEndsAt", "ctaUrl", "supportEmail"],
  },
  {
    key: "payment_failed_6",
    name: "Payment failed (day 6)",
    subject: "Final notice: payment failed — {{orgName}}",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p>Final notice for <strong>{{orgName}}</strong>: without payment before <strong>{{graceEndsAt}}</strong>, the workspace will be suspended.</p>",
    bodyText:
      "Hi {{adminName}},\n\nFinal notice for {{orgName}}: without payment before {{graceEndsAt}}, the workspace will be suspended.\n\n{{ctaUrl}}",
    variables: ["orgName", "adminName", "graceEndsAt", "ctaUrl", "supportEmail"],
  },
  {
    key: "suspended",
    name: "Workspace suspended",
    subject: "Workspace suspended — {{orgName}}",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p><strong>{{orgName}}</strong> is suspended due to unpaid billing. Outbound is paused; inbox still syncs. Pay to restore access.</p>",
    bodyText:
      "Hi {{adminName}},\n\n{{orgName}} is suspended due to unpaid billing. Outbound is paused; inbox still syncs. Pay to restore access.\n\n{{ctaUrl}}",
    variables: ["orgName", "adminName", "ctaUrl", "supportEmail"],
  },
  {
    key: "reactivated",
    name: "Workspace reactivated",
    subject: "Welcome back — {{orgName}} is active",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p>Payment received. <strong>{{orgName}}</strong> is active again and jobs can resume.</p>",
    bodyText:
      "Hi {{adminName}},\n\nPayment received. {{orgName}} is active again and jobs can resume.\n\n{{ctaUrl}}",
    variables: ["orgName", "adminName", "ctaUrl", "supportEmail"],
  },
  {
    key: "cancellation_scheduled",
    name: "Cancellation scheduled",
    subject: "Cancellation scheduled — {{orgName}}",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p>Your subscription for <strong>{{orgName}}</strong> will end on <strong>{{periodEnd}}</strong>. You keep access until then.</p>",
    bodyText:
      "Hi {{adminName}},\n\nYour subscription for {{orgName}} will end on {{periodEnd}}. You keep access until then.\n\n{{ctaUrl}}",
    variables: ["orgName", "adminName", "periodEnd", "ctaUrl", "supportEmail"],
  },
  {
    key: "canceled_export_reminder",
    name: "Canceled + export reminder",
    subject: "Subscription ended — export your data ({{orgName}})",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p><strong>{{orgName}}</strong> is canceled. Download a data export while you still have access (read-only until <strong>{{readOnlyUntil}}</strong>).</p>",
    bodyText:
      "Hi {{adminName}},\n\n{{orgName}} is canceled. Download a data export while you still have access (read-only until {{readOnlyUntil}}).\n\n{{ctaUrl}}",
    variables: [
      "orgName",
      "adminName",
      "readOnlyUntil",
      "ctaUrl",
      "supportEmail",
    ],
  },
  {
    key: "downgrade_reminder_7d",
    name: "Downgrade reminder (7 days)",
    subject: "Choose what stays active — {{orgName}}",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p>Your plan limits for <strong>{{featureKey}}</strong> take effect on <strong>{{deadlineAt}}</strong>. Choose which items stay active.</p>",
    bodyText:
      "Hi {{adminName}},\n\nYour plan limits for {{featureKey}} take effect on {{deadlineAt}}. Choose which items stay active.\n\n{{ctaUrl}}",
    variables: [
      "orgName",
      "adminName",
      "featureKey",
      "deadlineAt",
      "allowedCount",
      "ctaUrl",
      "supportEmail",
    ],
  },
  {
    key: "plan_limit_notice",
    name: "Plan limit notice",
    subject: "Plan limit change — {{orgName}}",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p>Your plan now allows <strong>{{allowedCount}}</strong> {{featureKey}}. Extras pause on <strong>{{deadlineAt}}</strong> unless you choose what stays.</p>",
    bodyText:
      "Hi {{adminName}},\n\nYour plan now allows {{allowedCount}} {{featureKey}}. Extras pause on {{deadlineAt}} unless you choose what stays.\n\n{{ctaUrl}}",
    variables: [
      "orgName",
      "adminName",
      "featureKey",
      "allowedCount",
      "deadlineAt",
      "ctaUrl",
      "supportEmail",
    ],
  },
  {
    key: "low_credits_20",
    name: "Low credits (20%)",
    subject: "Credits running low — {{orgName}}",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p>Credit balance for <strong>{{orgName}}</strong> is at or below 20% of your monthly allotment ({{balance}} left).</p>",
    bodyText:
      "Hi {{adminName}},\n\nCredit balance for {{orgName}} is at or below 20% of your monthly allotment ({{balance}} left).\n\n{{ctaUrl}}",
    variables: ["orgName", "adminName", "balance", "ctaUrl", "supportEmail"],
  },
  {
    key: "low_credits_5",
    name: "Low credits (5%)",
    subject: "Credits critically low — {{orgName}}",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p>Only about 5% of monthly credits remain for <strong>{{orgName}}</strong> ({{balance}} left). Top up soon.</p>",
    bodyText:
      "Hi {{adminName}},\n\nOnly about 5% of monthly credits remain for {{orgName}} ({{balance}} left). Top up soon.\n\n{{ctaUrl}}",
    variables: ["orgName", "adminName", "balance", "ctaUrl", "supportEmail"],
  },
  {
    key: "low_credits_0",
    name: "Out of credits",
    subject: "Out of credits — Autopilot paused ({{orgName}})",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p><strong>{{orgName}}</strong> has 0 credits. Credit-consuming jobs are paused until you add credits. Inbound replies still sync.</p>",
    bodyText:
      "Hi {{adminName}},\n\n{{orgName}} has 0 credits. Credit-consuming jobs are paused until you add credits. Inbound replies still sync.\n\n{{ctaUrl}}",
    variables: ["orgName", "adminName", "balance", "ctaUrl", "supportEmail"],
  },
  {
    key: "manual_renewal_reminder",
    name: "Manual renewal reminder",
    subject: "Invoice due soon — {{orgName}}",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p>Your manual invoice for <strong>{{orgName}}</strong> renews around <strong>{{periodEnd}}</strong>. Pay invoice <strong>{{invoiceNumber}}</strong> to stay active.</p>",
    bodyText:
      "Hi {{adminName}},\n\nYour manual invoice for {{orgName}} renews around {{periodEnd}}. Pay invoice {{invoiceNumber}} to stay active.\n\n{{ctaUrl}}",
    variables: [
      "orgName",
      "adminName",
      "periodEnd",
      "invoiceNumber",
      "amount",
      "ctaUrl",
      "supportEmail",
    ],
  },
  {
    key: "payment_received",
    name: "Payment received",
    subject: "Payment received — {{orgName}}",
    bodyHtml:
      "<p>Hi {{adminName}},</p><p>We received your payment for <strong>{{orgName}}</strong>. Thank you.</p>",
    bodyText:
      "Hi {{adminName}},\n\nWe received your payment for {{orgName}}. Thank you.\n\n{{ctaUrl}}",
    variables: [
      "orgName",
      "adminName",
      "amount",
      "currency",
      "ctaUrl",
      "supportEmail",
    ],
  },
];

async function ensureColumn(client, table, column, ddl, log) {
  if (await columnExists(client, table, column)) {
    log.push(`skip ${table}.${column}`);
    return;
  }
  await client.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN ${ddl}`);
  log.push(`ADD ${table}.${column}`);
}

async function main() {
  if (!isApply()) {
    console.error("Refusing to apply without APPLY=1");
    process.exit(1);
  }
  const prisma = createPrisma();
  const log = [];
  try {
    if (!(await enumExists(prisma, "EmailSendStatus"))) {
      await prisma.$executeRawUnsafe(`
        CREATE TYPE "EmailSendStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'BOUNCED')
      `);
      log.push("CREATE ENUM EmailSendStatus");
    } else {
      log.push("skip ENUM EmailSendStatus");
    }

    if (!(await tableExists(prisma, "email_templates"))) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "email_templates" (
          "id" TEXT NOT NULL,
          "key" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "subject" TEXT NOT NULL,
          "body_html" TEXT NOT NULL,
          "body_text" TEXT NOT NULL,
          "variables" JSONB NOT NULL DEFAULT '[]',
          "default_subject" TEXT NOT NULL,
          "default_body_html" TEXT NOT NULL,
          "default_body_text" TEXT NOT NULL,
          "updated_by_id" TEXT,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
        )
      `);
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX "email_templates_key_key" ON "email_templates"("key")`
      );
      log.push("CREATE TABLE email_templates");
    } else {
      log.push("skip table email_templates");
    }

    if (!(await tableExists(prisma, "email_send_logs"))) {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "email_send_logs" (
          "id" TEXT NOT NULL,
          "organization_id" TEXT,
          "to_email" TEXT NOT NULL,
          "template_key" TEXT NOT NULL,
          "event_key" TEXT NOT NULL,
          "status" "EmailSendStatus" NOT NULL DEFAULT 'QUEUED',
          "attempts" INTEGER NOT NULL DEFAULT 0,
          "max_attempts" INTEGER NOT NULL DEFAULT 3,
          "provider_message_id" TEXT,
          "error" TEXT,
          "subject" TEXT,
          "metadata" JSONB NOT NULL DEFAULT '{}',
          "next_retry_at" TIMESTAMP(3),
          "sent_at" TIMESTAMP(3),
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "email_send_logs_pkey" PRIMARY KEY ("id")
        )
      `);
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX "email_send_logs_event_key_key" ON "email_send_logs"("event_key")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "email_send_logs_organization_id_created_at_idx" ON "email_send_logs"("organization_id", "created_at")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "email_send_logs_status_next_retry_at_idx" ON "email_send_logs"("status", "next_retry_at")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "email_send_logs_template_key_created_at_idx" ON "email_send_logs"("template_key", "created_at")`
      );
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "email_send_logs"
        ADD CONSTRAINT "email_send_logs_organization_id_fkey"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
      `);
      log.push("CREATE TABLE email_send_logs");
    } else {
      log.push("skip table email_send_logs");
    }

    if (await tableExists(prisma, "payment_settings")) {
      await ensureColumn(
        prisma,
        "payment_settings",
        "platform_email_provider",
        `"platform_email_provider" TEXT NOT NULL DEFAULT 'SMTP'`,
        log
      );
      await ensureColumn(
        prisma,
        "payment_settings",
        "platform_email_from_email",
        `"platform_email_from_email" TEXT`,
        log
      );
      await ensureColumn(
        prisma,
        "payment_settings",
        "platform_email_from_name",
        `"platform_email_from_name" TEXT`,
        log
      );
      await ensureColumn(
        prisma,
        "payment_settings",
        "platform_email_reply_to",
        `"platform_email_reply_to" TEXT`,
        log
      );
      await ensureColumn(
        prisma,
        "payment_settings",
        "platform_email_domain",
        `"platform_email_domain" TEXT`,
        log
      );
      await ensureColumn(
        prisma,
        "payment_settings",
        "platform_email_resend_key_enc",
        `"platform_email_resend_key_enc" TEXT`,
        log
      );
    }

    // Seed templates (insert-only; never overwrite edited content)
    let seeded = 0;
    for (const t of DEFAULTS) {
      if (!TEMPLATE_KEYS.includes(t.key)) continue;
      const existing = await prisma.$queryRawUnsafe(
        `SELECT 1 FROM email_templates WHERE key = $1 LIMIT 1`,
        t.key
      );
      if (Array.isArray(existing) && existing.length) continue;
      const { randomUUID } = require("crypto");
      await prisma.$executeRawUnsafe(
        `INSERT INTO email_templates (
          id, key, name, subject, body_html, body_text, variables,
          default_subject, default_body_html, default_body_text,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7::jsonb,
          $4, $5, $6,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )`,
        randomUUID(),
        t.key,
        t.name,
        t.subject,
        t.bodyHtml,
        t.bodyText,
        JSON.stringify(t.variables)
      );
      seeded++;
    }
    log.push(`seeded templates: ${seeded}`);

    console.log(JSON.stringify({ slice: "B5a", mode: "apply", log }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

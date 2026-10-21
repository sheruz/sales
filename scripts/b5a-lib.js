/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * B5a shared helpers — schema checks + default template seed list.
 */
require("./load-env");
const { ensureDatabaseUrl } = require("./database-url");
ensureDatabaseUrl();

const {
  createPrisma,
  readOnlyPrisma,
  tableExists,
  columnExists,
  enumExists,
  enumHasValue,
  isApply,
} = require("./s2-lib");

const TEMPLATE_KEYS = [
  "trial_ending_3d",
  "trial_ending_1d",
  "trial_expired",
  "payment_failed_0",
  "payment_failed_3",
  "payment_failed_6",
  "suspended",
  "reactivated",
  "cancellation_scheduled",
  "canceled_export_reminder",
  "downgrade_reminder_7d",
  "plan_limit_notice",
  "low_credits_20",
  "low_credits_5",
  "low_credits_0",
  "manual_renewal_reminder",
  "payment_received",
];

const PAYMENT_SETTINGS_COLUMNS = [
  "platform_email_provider",
  "platform_email_from_email",
  "platform_email_from_name",
  "platform_email_reply_to",
  "platform_email_domain",
  "platform_email_resend_key_enc",
];

async function schemaReport(prisma) {
  return {
    enum_EmailSendStatus: await enumExists(prisma, "EmailSendStatus"),
    table_email_templates: await tableExists(prisma, "email_templates"),
    table_email_send_logs: await tableExists(prisma, "email_send_logs"),
    payment_settings_columns: Object.fromEntries(
      await Promise.all(
        PAYMENT_SETTINGS_COLUMNS.map(async (c) => [
          c,
          await columnExists(prisma, "payment_settings", c),
        ])
      )
    ),
  };
}

module.exports = {
  createPrisma,
  readOnlyPrisma,
  tableExists,
  columnExists,
  enumExists,
  enumHasValue,
  isApply,
  TEMPLATE_KEYS,
  PAYMENT_SETTINGS_COLUMNS,
  schemaReport,
};

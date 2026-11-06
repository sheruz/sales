/**
 * Idempotent seed of 3 Super Admin Outreach templates (A/B/C).
 *
 *   DRY_RUN=1 node scripts/run-with-env.js node scripts/platform-outreach-seed-templates.js
 *   node scripts/run-with-env.js node scripts/platform-outreach-seed-templates.js
 */
/* eslint-disable @typescript-eslint/no-require-imports */
require("./load-env");
const { PrismaClient } = require("@prisma/client");
const { randomUUID } = require("crypto");

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

const TEMPLATES = [
  {
    key: "first_touch_has_website",
    name: "First touch – has website",
    category: "FIRST_TOUCH",
    sortOrder: 0,
    subject: "a few ideas for {{company_name}}'s website",
    bodyText: `Hi {{first_name}},

Our team at Delvix Studio took a look at {{company_name}}'s website on mobile, the way most of your customers see it, and spotted a few quick wins that could bring you more calls and enquiries.

Nothing major: small fixes to speed, contact forms and how easily visitors can reach you.

We build websites, booking systems and custom software for growing businesses, with a clear fixed price and a working demo every week.

Shall we send over the ideas? It's free, and there's no obligation.

Best regards,
Delvix Studio
delvixstudio.com | +1 609 691 6966
{{business_address}}

Not relevant? Reply "no" and we won't contact you again.`,
  },
  {
    key: "first_touch_no_website",
    name: "First touch – no website",
    category: "FIRST_TOUCH",
    sortOrder: 1,
    subject: "helping customers find {{company_name}} online",
    bodyText: `Hi {{first_name}},

We came across {{company_name}} and noticed you don't have a website yet. Today most customers search online before they call, so a simple site can quietly bring you new business every week.

At Delvix Studio we build fast, professional websites with everything a local business needs: a quote or booking form, click-to-call, Google Maps and mobile-friendly pages. You get a fixed price up front and own everything.

Would you like us to send a free sample of what {{company_name}}'s website could look like?

Best regards,
Delvix Studio
delvixstudio.com | +1 609 691 6966
{{business_address}}

Not relevant? Reply "no" and we won't contact you again.`,
  },
  {
    key: "follow_up_day_4",
    name: "Follow-up day 4",
    category: "FOLLOW_UP",
    sortOrder: 2,
    subject: "Re: {{original_subject}}",
    bodyText: `Hi {{first_name}},

Just following up in case our last email got buried. We'd be happy to send the ideas for {{company_name}}, free and with no strings attached.

If someone else looks after this, could you point us to the right person?

Best regards,
Delvix Studio
delvixstudio.com | +1 609 691 6966
{{business_address}}

Not relevant? Reply "no" and we won't contact you again.`,
  },
];

function esc(s) {
  return String(s).replace(/'/g, "''");
}

async function main() {
  console.log(
    `Platform outreach template seed${DRY_RUN ? " (DRY_RUN)" : ""}`
  );

  const exists = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'platform_outreach_templates' LIMIT 1`
  );
  if (!Array.isArray(exists) || !exists.length) {
    throw new Error("Run platform-outreach-migrate.js first");
  }

  for (const t of TEMPLATES) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT id FROM platform_outreach_templates WHERE key = $1 LIMIT 1`,
      t.key
    );
    if (Array.isArray(rows) && rows.length) {
      console.log(`  skip ${t.key} (exists)`);
      continue;
    }
    const sql = `
INSERT INTO platform_outreach_templates
  (id, key, name, category, subject, body_text, active, sort_order, created_at, updated_at)
VALUES (
  '${randomUUID()}',
  '${esc(t.key)}',
  '${esc(t.name)}',
  '${esc(t.category)}',
  '${esc(t.subject)}',
  '${esc(t.bodyText)}',
  true,
  ${t.sortOrder},
  NOW(),
  NOW()
)`;
    console.log(`  ${DRY_RUN ? "DRY " : ""}insert ${t.key}`);
    if (!DRY_RUN) await prisma.$executeRawUnsafe(sql);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

/**
 * Super Admin — agency website plans (engagement models + starter offers).
 * Separate from SaaS Plan / Packages entitlements.
 *
 *   DRY_RUN=1 node scripts/run-with-env.js node scripts/website-agency-plans-migrate.js
 *   node scripts/run-with-env.js node scripts/website-agency-plans-migrate.js
 */
/* eslint-disable @typescript-eslint/no-require-imports */
require("./load-env");
const { PrismaClient } = require("@prisma/client");
const { randomUUID } = require("crypto");

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

async function tableExists(table) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
    table
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function exec(sql) {
  console.log(`  ${DRY_RUN ? "DRY " : ""}${sql.split("\n")[0].slice(0, 100)}…`);
  if (!DRY_RUN) await prisma.$executeRawUnsafe(sql);
}

const DEFAULT_PLANS = [
  {
    slug: "fixed-price",
    name: "Fixed-price project",
    priceLabel: "From $X",
    priceUnit: "per project",
    description: "A defined app, portal or system with a written scope.",
    includes: [
      "Written scope in 3 days",
      "Milestone payments",
      "Weekly demos",
      "Full code ownership",
    ],
    ctaLabel: "Get a quote",
    ctaHref: "/contact?type=quote",
    featured: false,
    sortOrder: 0,
  },
  {
    slug: "retainer",
    name: "Monthly retainer",
    priceLabel: "From $X",
    priceUnit: "/ month",
    description: "Ongoing improvements to a live product.",
    includes: [
      "Planned work each month",
      "Priority fixes",
      "Monthly report",
      "Cancel with 30 days notice",
    ],
    ctaLabel: "Discuss a retainer",
    ctaHref: "/contact?type=retainer",
    featured: true,
    sortOrder: 1,
  },
  {
    slug: "dedicated",
    name: "Dedicated developer",
    priceLabel: "From $X",
    priceUnit: "/ month",
    description: "A developer working inside your team and tools.",
    includes: [
      "Full-time or part-time",
      "Overlap with your hours",
      "Your tools and process",
      "Replace if not a fit",
    ],
    ctaLabel: "Hire a developer",
    ctaHref: "/contact?type=developer",
    featured: false,
    sortOrder: 2,
  },
];

const DEFAULT_OFFERS = [
  {
    name: "Website fix + speed-up",
    priceLabel: "$X",
    description: "Critical fixes and performance pass — typically 5–7 days",
    deliveryDays: 7,
    href: "/contact?type=starter",
    sortOrder: 0,
  },
  {
    name: "Mobile quote form",
    priceLabel: "$X",
    description: "Mobile-friendly quote / contact form — typically 3–5 days",
    deliveryDays: 5,
    href: "/contact?type=starter",
    sortOrder: 1,
  },
  {
    name: "Discovery & scope",
    priceLabel: "$X",
    description: "Written scope, risks and estimate — typically 3 days",
    deliveryDays: 3,
    href: "/contact?type=starter",
    sortOrder: 2,
  },
];

async function main() {
  console.log(`Website agency plans migrate${DRY_RUN ? " (DRY_RUN)" : ""}`);

  if (!(await tableExists("website_engagement_plans"))) {
    await exec(`
CREATE TABLE "website_engagement_plans" (
  "id" TEXT PRIMARY KEY,
  "slug" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "price_label" TEXT NOT NULL,
  "price_unit" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "includes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "cta_label" TEXT NOT NULL,
  "cta_href" TEXT NOT NULL,
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);
    await exec(
      `CREATE INDEX "website_engagement_plans_active_sort_order_idx"
       ON "website_engagement_plans"("active", "sort_order")`
    );
  } else {
    console.log("  website_engagement_plans exists");
  }

  if (!(await tableExists("website_starter_offers"))) {
    await exec(`
CREATE TABLE "website_starter_offers" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "price_label" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "delivery_days" INTEGER,
  "href" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);
    await exec(
      `CREATE INDEX "website_starter_offers_active_sort_order_idx"
       ON "website_starter_offers"("active", "sort_order")`
    );
  } else {
    console.log("  website_starter_offers exists");
  }

  if (DRY_RUN) {
    console.log("  skip seed (DRY_RUN)");
    return;
  }

  const planCount = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS c FROM website_engagement_plans`
  );
  function esc(s) {
    return String(s).replace(/'/g, "''");
  }
  function arr(list) {
    return `ARRAY[${list.map((x) => `'${esc(x)}'`).join(",")}]::text[]`;
  }

  if ((planCount?.[0]?.c ?? 0) === 0) {
    for (const p of DEFAULT_PLANS) {
      await exec(`
INSERT INTO website_engagement_plans
  (id, slug, name, price_label, price_unit, description, includes,
   cta_label, cta_href, featured, active, sort_order, created_at, updated_at)
VALUES (
  '${randomUUID()}',
  '${esc(p.slug)}',
  '${esc(p.name)}',
  '${esc(p.priceLabel)}',
  '${esc(p.priceUnit)}',
  '${esc(p.description)}',
  ${arr(p.includes)},
  '${esc(p.ctaLabel)}',
  '${esc(p.ctaHref)}',
  ${p.featured},
  true,
  ${p.sortOrder},
  NOW(),
  NOW()
)`);
    }
    console.log(`  seeded ${DEFAULT_PLANS.length} engagement plans`);
  } else {
    console.log("  engagement plans already present — skip seed");
  }

  const offerCount = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS c FROM website_starter_offers`
  );
  if ((offerCount?.[0]?.c ?? 0) === 0) {
    for (const o of DEFAULT_OFFERS) {
      await exec(`
INSERT INTO website_starter_offers
  (id, name, price_label, description, delivery_days, href, active, sort_order, created_at, updated_at)
VALUES (
  '${randomUUID()}',
  '${esc(o.name)}',
  '${esc(o.priceLabel)}',
  '${esc(o.description)}',
  ${o.deliveryDays == null ? "NULL" : o.deliveryDays},
  ${o.href ? `'${esc(o.href)}'` : "NULL"},
  true,
  ${o.sortOrder},
  NOW(),
  NOW()
)`);
    }
    console.log(`  seeded ${DEFAULT_OFFERS.length} starter offers`);
  } else {
    console.log("  starter offers already present — skip seed");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

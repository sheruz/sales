import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const rows = await p.$queryRawUnsafe<
    { column_name: string }[]
  >(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='organizations'
     ORDER BY 1`
  );
  console.log(rows.map((r) => r.column_name).join("\n"));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());

// Container-start migration runner. Replaces the old `prisma db push
// --accept-data-loss` CMD, which could silently destroy customer data on a
// schema change — with OTA updates that risk is unacceptable.
//
// Handles three device states:
//   1. Fresh DB (first boot)        → `migrate deploy` applies everything.
//   2. Pre-migration DB (db push)   → mark the 0_baseline migration as already
//      applied, then deploy the rest. Detected by: app tables exist but
//      Prisma's _prisma_migrations bookkeeping table does not.
//   3. Already migrated             → deploy applies only pending migrations.
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

function prismaCli(args) {
  // Direct path instead of npx/.bin — immune to PATH and symlink issues.
  const res = spawnSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", ...args, "--schema", "prisma/schema.prisma"],
    { stdio: "inherit" },
  );
  if (res.status !== 0) {
    console.error(`[migrate] prisma ${args.join(" ")} failed (exit ${res.status})`);
    process.exit(res.status ?? 1);
  }
}

const prisma = new PrismaClient();
let tableNames;
try {
  const rows = await prisma.$queryRaw`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name IN ('_prisma_migrations', 'Installation')
  `;
  tableNames = new Set(rows.map((r) => r.name));
} finally {
  await prisma.$disconnect();
}

if (tableNames.has("Installation") && !tableNames.has("_prisma_migrations")) {
  console.log("[migrate] pre-migration database detected — baselining");
  prismaCli(["migrate", "resolve", "--applied", "0_baseline"]);
}

prismaCli(["migrate", "deploy"]);

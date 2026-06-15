import "server-only";

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

// WAL mode persists in the DB header so it survives restarts; busy_timeout and
// synchronous need re-applying per connection. With connection_limit=1 the
// single connection retains these for its lifetime.
// Use $queryRawUnsafe for all three: PRAGMA journal_mode and busy_timeout each
// return a result row, which $executeRaw rejects as "Execute returned results,
// which is not allowed in SQLite". $queryRawUnsafe is also harmless for the
// row-less synchronous pragma (it just yields an empty result).
void db.$queryRawUnsafe("PRAGMA journal_mode=WAL;")
  .then(() => db.$queryRawUnsafe("PRAGMA busy_timeout=5000;"))
  .then(() => db.$queryRawUnsafe("PRAGMA synchronous=NORMAL;"))
  .catch(() => {});

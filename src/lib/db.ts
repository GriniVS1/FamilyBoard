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
// journal_mode returns a result row so it needs $queryRawUnsafe; the other two
// are side-effect-only and must use $executeRawUnsafe.
void db.$queryRawUnsafe("PRAGMA journal_mode=WAL;")
  .then(() => db.$executeRawUnsafe("PRAGMA busy_timeout=5000;"))
  .then(() => db.$executeRawUnsafe("PRAGMA synchronous=NORMAL;"))
  .catch(() => {});

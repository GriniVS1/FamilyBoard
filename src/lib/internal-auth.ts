import "server-only";

import { timingSafeEqual } from "node:crypto";
import { requireAdminPin } from "@/lib/admin-pin";
import { getInternalSecret, INTERNAL_SECRET_HEADER } from "@/lib/internal-secret";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// Gate for endpoints that are normally driven by the internal cron
// (instrumentation.ts) but may also be triggered manually from the PIN-unlocked
// settings UI. Accept the internal secret OR a valid admin PIN; the PIN branch
// reuses requireAdminPin, which rate-limits and throws on a missing/invalid PIN.
export async function requireInternalOrAdmin(req: Request): Promise<void> {
  const provided = req.headers.get(INTERNAL_SECRET_HEADER);
  if (provided && safeEqual(provided, getInternalSecret())) return;

  await requireAdminPin(req);
}

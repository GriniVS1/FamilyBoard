import { ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { getPointsOverviewForFamily } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const family = await db.family.findFirst();
  if (!family) return ok({ members: [] });
  return ok(await getPointsOverviewForFamily(family.id));
});

import { ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { requireMobileAuth } from "@/lib/mobile-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withErrorHandling(async (req) => {
  const ctx = await requireMobileAuth(req);

  const result = await db.groceryItem.deleteMany({
    where: { familyId: ctx.familyId, checked: true },
  });

  return ok({ deleted: result.count });
});

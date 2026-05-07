import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export const POST = withErrorHandling(async () => {
  const family = await db.family.findFirst();
  if (!family) {
    throw new AppError("Family not found", "FAMILY_NOT_FOUND", 400);
  }

  const result = await db.groceryItem.deleteMany({
    where: { familyId: family.id, checked: true },
  });

  return ok({ deleted: result.count });
});

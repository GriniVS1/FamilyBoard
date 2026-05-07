import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { GROCERY_CATEGORIES } from "@/lib/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  quantity: z.string().max(50).optional().nullable(),
  unit: z.string().max(50).optional().nullable(),
  category: z.enum(GROCERY_CATEGORIES).optional().nullable(),
});

export const GET = withErrorHandling(async () => {
  const family = await db.family.findFirst();
  if (!family) return ok([]);

  const items = await db.groceryItem.findMany({
    where: { familyId: family.id },
    orderBy: [{ category: "asc" }, { order: "asc" }, { createdAt: "asc" }],
  });

  return ok(items);
});

export const POST = withErrorHandling(async (req) => {
  const body = createSchema.parse(await req.json());

  const family = await db.family.findFirst();
  if (!family) {
    throw new AppError(
      "Create a family before adding grocery items",
      "FAMILY_NOT_FOUND",
      400,
    );
  }

  const item = await db.groceryItem.create({
    data: {
      familyId: family.id,
      name: body.name,
      quantity: body.quantity ?? null,
      unit: body.unit ?? null,
      category: body.category ?? null,
      source: "manual",
    },
  });

  return ok(item);
});

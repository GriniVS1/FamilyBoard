import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { parseQuantity } from "@/lib/utils";

export const runtime = "nodejs";

const bodySchema = z.object({
  recipeId: z.string().min(1),
  multiplier: z.number().positive().optional().default(1),
});

export const POST = withErrorHandling(async (req) => {
  const body = bodySchema.parse(await req.json());

  const family = await db.family.findFirst();
  if (!family) {
    throw new AppError("Family not found", "FAMILY_NOT_FOUND", 400);
  }

  const recipe = await db.recipe.findUnique({
    where: { id: body.recipeId },
    include: { ingredients: { orderBy: { order: "asc" } } },
  });
  if (!recipe || recipe.familyId !== family.id) {
    throw new AppError("Recipe not found", "RECIPE_NOT_FOUND", 404);
  }

  const items = await db.$transaction(
    recipe.ingredients.map((ing) => {
      const parsed = ing.quantity ? parseQuantity(ing.quantity) : null;
      const scaledQty =
        parsed !== null
          ? String(Math.round(parsed * body.multiplier * 100) / 100)
          : ing.quantity;

      return db.groceryItem.create({
        data: {
          familyId: family.id,
          name: ing.name,
          quantity: scaledQty ?? null,
          unit: ing.unit ?? null,
          source: `recipe:${recipe.id}`,
        },
      });
    }),
  );

  return ok(items);
});

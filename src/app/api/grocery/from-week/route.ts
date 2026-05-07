import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { parseQuantity } from "@/lib/utils";

export const runtime = "nodejs";

const bodySchema = z.object({
  startDate: z.coerce.date(),
});

type AggKey = string; // `${name}|||${unit}`
type AggEntry = {
  name: string;
  unit: string | null;
  numericSum: number;
  isNumeric: boolean;
  rawQuantity: string | null;
  mealPlanId: string;
};

export const POST = withErrorHandling(async (req) => {
  const body = bodySchema.parse(await req.json());

  const family = await db.family.findFirst();
  if (!family) {
    throw new AppError("Family not found", "FAMILY_NOT_FOUND", 400);
  }

  const weekEnd = new Date(body.startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

  const plans = await db.mealPlan.findMany({
    where: {
      familyId: family.id,
      date: { gte: body.startDate, lt: weekEnd },
      recipeId: { not: null },
    },
    include: {
      recipe: {
        include: { ingredients: { orderBy: { order: "asc" } } },
      },
    },
  });

  const agg = new Map<AggKey, AggEntry>();

  for (const plan of plans) {
    if (!plan.recipe) continue;
    for (const ing of plan.recipe.ingredients) {
      const unit = ing.unit ?? null;
      const key: AggKey = `${ing.name.toLowerCase()}|||${unit ?? ""}`;
      const parsed = ing.quantity ? parseQuantity(ing.quantity) : null;

      const existing = agg.get(key);
      if (existing) {
        if (existing.isNumeric && parsed !== null) {
          existing.numericSum += parsed;
        } else {
          existing.isNumeric = false;
        }
      } else {
        agg.set(key, {
          name: ing.name,
          unit,
          numericSum: parsed ?? 0,
          isNumeric: parsed !== null,
          rawQuantity: ing.quantity ?? null,
          mealPlanId: plan.id,
        });
      }
    }
  }

  const created = await db.$transaction(
    Array.from(agg.values()).map((entry) => {
      const quantity = entry.isNumeric
        ? String(Math.round(entry.numericSum * 100) / 100)
        : entry.rawQuantity;

      return db.groceryItem.create({
        data: {
          familyId: family.id,
          name: entry.name,
          quantity: quantity ?? null,
          unit: entry.unit ?? null,
          source: `mealplan:${entry.mealPlanId}`,
        },
      });
    }),
  );

  return ok(created);
});

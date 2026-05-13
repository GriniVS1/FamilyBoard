import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { parseQuantity } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ITEM_CAP = 500;

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
  const ctx = await requireMobileAuth(req);
  const body = bodySchema.parse(await req.json());

  const weekEnd = new Date(body.startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

  const plans = await db.mealPlan.findMany({
    where: {
      familyId: ctx.familyId,
      date: { gte: body.startDate, lt: weekEnd },
      recipeId: { not: null },
    },
    include: {
      recipe: {
        include: { ingredients: { orderBy: { order: "asc" } } },
      },
    },
  });

  if (plans.length === 0) {
    return ok({ created: [], count: 0 });
  }

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

  const newItemCount = agg.size;
  if (newItemCount > 0) {
    const currentCount = await db.groceryItem.count({
      where: { familyId: ctx.familyId },
    });
    if (currentCount + newItemCount > ITEM_CAP) {
      throw new AppError("Too many items", "TOO_MANY_ITEMS", 400);
    }
  }

  const created = await db.$transaction(
    Array.from(agg.values()).map((entry) => {
      const quantity = entry.isNumeric
        ? String(Math.round(entry.numericSum * 100) / 100)
        : entry.rawQuantity;

      return db.groceryItem.create({
        data: {
          familyId: ctx.familyId,
          name: entry.name,
          quantity: quantity ?? null,
          unit: entry.unit ?? null,
          source: `mealplan:${entry.mealPlanId}`,
        },
      });
    }),
  );

  const serialized = created.map((item) => ({
    id: item.id,
    familyId: item.familyId,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    category: item.category,
    checked: item.checked,
    source: item.source,
    order: item.order,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }));

  return ok({ created: serialized, count: serialized.length });
});

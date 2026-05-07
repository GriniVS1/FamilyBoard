import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { MEAL_SLOTS } from "@/lib/enums";

export const runtime = "nodejs";

const updateSchema = z
  .object({
    date: z.coerce.date().optional(),
    slot: z.enum(MEAL_SLOTS).optional(),
    recipeId: z.string().min(1).optional().nullable(),
    customName: z.string().trim().min(1).max(200).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
    memberId: z.string().min(1).optional().nullable(),
  })
  .refine(
    (d) => {
      const hasRecipe = d.recipeId !== undefined;
      const hasCustom = d.customName !== undefined;
      if (!hasRecipe && !hasCustom) return true;
      return d.recipeId != null || d.customName != null;
    },
    {
      message: "Cannot clear both recipeId and customName simultaneously",
      path: ["recipeId"],
    },
  );

type Ctx = { params: Promise<{ id: string }> };

async function getPlanOrThrow(id: string) {
  const plan = await db.mealPlan.findUnique({ where: { id } });
  if (!plan)
    throw new AppError("Meal plan not found", "MEAL_PLAN_NOT_FOUND", 404);
  return plan;
}

export const PATCH = withErrorHandling<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const plan = await getPlanOrThrow(id);
  const body = updateSchema.parse(await req.json());

  if (body.recipeId) {
    const recipe = await db.recipe.findUnique({
      where: { id: body.recipeId },
    });
    if (!recipe || recipe.familyId !== plan.familyId) {
      throw new AppError("Recipe not found", "RECIPE_NOT_FOUND", 404);
    }
  }

  if (body.memberId) {
    const member = await db.member.findUnique({
      where: { id: body.memberId },
    });
    if (!member || member.familyId !== plan.familyId) {
      throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);
    }
  }

  const updated = await db.mealPlan.update({
    where: { id },
    data: {
      ...(body.date !== undefined && { date: body.date }),
      ...(body.slot !== undefined && { slot: body.slot }),
      ...(body.recipeId !== undefined && { recipeId: body.recipeId }),
      ...(body.customName !== undefined && { customName: body.customName }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.memberId !== undefined && { memberId: body.memberId }),
    },
    include: {
      recipe: { select: { id: true, name: true, imageUrl: true } },
      member: { select: { id: true, name: true, color: true } },
    },
  });

  return ok(updated);
});

export const DELETE = withErrorHandling<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  await getPlanOrThrow(id);
  await db.mealPlan.delete({ where: { id } });
  return ok({ ok: true });
});

import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const ingredientSchema = z.object({
  name: z.string().trim().min(1).max(200),
  quantity: z.string().max(50).optional().nullable(),
  unit: z.string().max(50).optional().nullable(),
  order: z.number().int().optional().default(0),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  servings: z.number().int().positive().optional().nullable(),
  prepMinutes: z.number().int().nonnegative().optional().nullable(),
  cookMinutes: z.number().int().nonnegative().optional().nullable(),
  instructions: z.string().max(20000).optional().nullable(),
  sourceUrl: z.string().url().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  tags: z.string().max(500).optional(),
  ingredients: z.array(ingredientSchema).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

async function getRecipeOrThrow(id: string) {
  const recipe = await db.recipe.findUnique({ where: { id } });
  if (!recipe) throw new AppError("Recipe not found", "RECIPE_NOT_FOUND", 404);
  return recipe;
}

export const GET = withErrorHandling<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const recipe = await db.recipe.findUnique({
    where: { id },
    include: { ingredients: { orderBy: { order: "asc" } } },
  });
  if (!recipe) throw new AppError("Recipe not found", "RECIPE_NOT_FOUND", 404);
  return ok(recipe);
});

export const PATCH = withErrorHandling<Ctx>(async (req, { params }) => {
  const { id } = await params;
  await getRecipeOrThrow(id);

  const body = updateSchema.parse(await req.json());

  const recipe = await db.$transaction(async (tx) => {
    if (body.ingredients !== undefined) {
      await tx.ingredient.deleteMany({ where: { recipeId: id } });
    }

    return tx.recipe.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && {
          description: body.description,
        }),
        ...(body.servings !== undefined && { servings: body.servings }),
        ...(body.prepMinutes !== undefined && {
          prepMinutes: body.prepMinutes,
        }),
        ...(body.cookMinutes !== undefined && {
          cookMinutes: body.cookMinutes,
        }),
        ...(body.instructions !== undefined && {
          instructions: body.instructions,
        }),
        ...(body.sourceUrl !== undefined && { sourceUrl: body.sourceUrl }),
        ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
        ...(body.tags !== undefined && { tags: body.tags }),
        ...(body.ingredients !== undefined && {
          ingredients: {
            create: body.ingredients.map((ing, idx) => ({
              name: ing.name,
              quantity: ing.quantity ?? null,
              unit: ing.unit ?? null,
              order: ing.order ?? idx,
            })),
          },
        }),
      },
      include: { ingredients: { orderBy: { order: "asc" } } },
    });
  });

  return ok(recipe);
});

export const DELETE = withErrorHandling<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  await getRecipeOrThrow(id);
  await db.recipe.delete({ where: { id } });
  return ok({ ok: true });
});

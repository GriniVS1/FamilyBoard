import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ingredientSchema = z.object({
  name: z.string().trim().min(1).max(200),
  quantity: z.string().max(50).optional().nullable(),
  unit: z.string().max(50).optional().nullable(),
  order: z.number().int().optional().default(0),
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  servings: z.number().int().positive().optional().nullable(),
  prepMinutes: z.number().int().nonnegative().optional().nullable(),
  cookMinutes: z.number().int().nonnegative().optional().nullable(),
  instructions: z.string().max(20000).optional().nullable(),
  sourceUrl: z.string().url().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  tags: z.string().max(500).optional().default(""),
  ingredients: z.array(ingredientSchema).optional().default([]),
});

export const GET = withErrorHandling(async () => {
  const family = await db.family.findFirst();
  if (!family) return ok([]);

  const recipes = await db.recipe.findMany({
    where: { familyId: family.id },
    include: {
      ingredients: { orderBy: { order: "asc" } },
    },
    orderBy: { name: "asc" },
  });

  return ok(recipes);
});

export const POST = withErrorHandling(async (req) => {
  const body = createSchema.parse(await req.json());

  const family = await db.family.findFirst();
  if (!family) {
    throw new AppError(
      "Create a family before adding recipes",
      "FAMILY_NOT_FOUND",
      400,
    );
  }

  const recipe = await db.recipe.create({
    data: {
      familyId: family.id,
      name: body.name,
      description: body.description ?? null,
      servings: body.servings ?? null,
      prepMinutes: body.prepMinutes ?? null,
      cookMinutes: body.cookMinutes ?? null,
      instructions: body.instructions ?? null,
      sourceUrl: body.sourceUrl ?? null,
      imageUrl: body.imageUrl ?? null,
      tags: body.tags,
      ingredients: {
        create: body.ingredients.map((ing, idx) => ({
          name: ing.name,
          quantity: ing.quantity ?? null,
          unit: ing.unit ?? null,
          order: ing.order ?? idx,
        })),
      },
    },
    include: {
      ingredients: { orderBy: { order: "asc" } },
    },
  });

  return ok(recipe);
});

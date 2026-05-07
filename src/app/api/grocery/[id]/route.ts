import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { GROCERY_CATEGORIES } from "@/lib/enums";

export const runtime = "nodejs";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  quantity: z.string().max(50).optional().nullable(),
  unit: z.string().max(50).optional().nullable(),
  category: z.enum(GROCERY_CATEGORIES).optional().nullable(),
  checked: z.boolean().optional(),
  order: z.number().int().nonnegative().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

async function getItemOrThrow(id: string) {
  const item = await db.groceryItem.findUnique({ where: { id } });
  if (!item)
    throw new AppError("Grocery item not found", "GROCERY_ITEM_NOT_FOUND", 404);
  return item;
}

export const PATCH = withErrorHandling<Ctx>(async (req, { params }) => {
  const { id } = await params;
  await getItemOrThrow(id);

  const body = updateSchema.parse(await req.json());

  const item = await db.groceryItem.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.quantity !== undefined && { quantity: body.quantity }),
      ...(body.unit !== undefined && { unit: body.unit }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.checked !== undefined && { checked: body.checked }),
      ...(body.order !== undefined && { order: body.order }),
    },
  });

  return ok(item);
});

export const DELETE = withErrorHandling<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  await getItemOrThrow(id);
  await db.groceryItem.delete({ where: { id } });
  return ok({ ok: true });
});

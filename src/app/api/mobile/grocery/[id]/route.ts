import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { GROCERY_CATEGORIES } from "@/lib/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    checked: z.boolean().optional(),
    name: z.string().trim().min(1).max(200).optional(),
    quantity: z.string().max(50).optional(),
    unit: z.string().max(50).optional(),
    category: z.enum(GROCERY_CATEGORIES).optional(),
  })
  .refine(
    (v) =>
      v.checked !== undefined ||
      v.name !== undefined ||
      v.quantity !== undefined ||
      v.unit !== undefined ||
      v.category !== undefined,
    { message: "At least one field must be provided" },
  );

type Ctx = { params: Promise<{ id: string }> };

async function resolveItem(id: string, familyId: string) {
  const item = await db.groceryItem.findUnique({ where: { id } });
  if (!item || item.familyId !== familyId) {
    throw new AppError("Grocery item not found", "GROCERY_NOT_FOUND", 404);
  }
  return item;
}

function serializeItem(item: {
  id: string;
  familyId: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  category: string | null;
  checked: boolean;
  source: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
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
  };
}

export const PATCH = withErrorHandling<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const ctx = await requireMobileAuth(req);

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    throw new AppError("Invalid JSON body", "VALIDATION_ERROR", 400);
  }

  const parsed = patchSchema.safeParse(rawBody);
  if (!parsed.success) {
    if (
      parsed.error.issues.some(
        (i) => i.path.length === 0 && i.code === "custom",
      )
    ) {
      throw new AppError(
        "At least one field must be provided",
        "NO_OP",
        400,
      );
    }
    throw parsed.error;
  }
  const body = parsed.data;

  await resolveItem(id, ctx.familyId);

  const updated = await db.groceryItem.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.quantity !== undefined && { quantity: body.quantity }),
      ...(body.unit !== undefined && { unit: body.unit }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.checked !== undefined && { checked: body.checked }),
    },
  });

  return ok(serializeItem(updated));
});

export const DELETE = withErrorHandling<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const ctx = await requireMobileAuth(req);

  await resolveItem(id, ctx.familyId);

  await db.groceryItem.delete({ where: { id } });
  return ok({ ok: true });
});

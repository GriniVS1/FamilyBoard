import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { GROCERY_CATEGORIES } from "@/lib/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ITEM_CAP = 500;

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  quantity: z.string().max(50).optional(),
  unit: z.string().max(50).optional(),
  category: z.enum(GROCERY_CATEGORIES).optional(),
});

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

export const GET = withErrorHandling(async (req) => {
  const ctx = await requireMobileAuth(req);

  const items = await db.groceryItem.findMany({
    where: { familyId: ctx.familyId },
    orderBy: [
      { checked: "asc" },
      { category: "asc" },
      { order: "asc" },
      { createdAt: "asc" },
    ],
    take: ITEM_CAP,
  });

  return ok({ items: items.map(serializeItem) });
});

export const POST = withErrorHandling(async (req) => {
  const ctx = await requireMobileAuth(req);
  const body = createSchema.parse(await req.json());

  const count = await db.groceryItem.count({
    where: { familyId: ctx.familyId },
  });
  if (count >= ITEM_CAP) {
    throw new AppError(
      "Family has reached the grocery item limit",
      "TOO_MANY_ITEMS",
      400,
    );
  }

  const maxOrderResult = await db.groceryItem.aggregate({
    where: { familyId: ctx.familyId },
    _max: { order: true },
  });
  const nextOrder = (maxOrderResult._max.order ?? -1) + 1;

  const item = await db.groceryItem.create({
    data: {
      familyId: ctx.familyId,
      name: body.name,
      quantity: body.quantity ?? null,
      unit: body.unit ?? null,
      category: body.category ?? null,
      source: "manual",
      order: nextOrder,
    },
  });

  return ok(serializeItem(item), { status: 201 });
});

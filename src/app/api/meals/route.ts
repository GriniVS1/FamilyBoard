import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { MEAL_SLOTS } from "@/lib/enums";
import { sendNotificationToFamily } from "@/lib/notifications";
import { getNotificationTranslator } from "@/lib/notification-i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z
  .object({
    date: z.coerce.date(),
    slot: z.enum(MEAL_SLOTS),
    recipeId: z.string().min(1).optional().nullable(),
    customName: z.string().trim().min(1).max(200).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
    memberId: z.string().min(1).optional().nullable(),
  })
  .refine((d) => d.recipeId != null || d.customName != null, {
    message: "Either recipeId or customName is required",
    path: ["recipeId"],
  });

export const GET = withErrorHandling(async (req) => {
  const url = new URL(req.url);
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");

  if (!fromStr || !toStr) {
    throw new AppError("from and to are required", "MISSING_RANGE", 400);
  }

  const from = new Date(fromStr);
  const to = new Date(toStr);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new AppError("from/to must be ISO datetimes", "INVALID_RANGE", 400);
  }

  const family = await db.family.findFirst();
  if (!family) return ok([]);

  const plans = await db.mealPlan.findMany({
    where: {
      familyId: family.id,
      date: { gte: from, lt: to },
    },
    include: {
      recipe: { select: { id: true, name: true, imageUrl: true } },
      member: { select: { id: true, name: true, color: true } },
    },
    orderBy: [{ date: "asc" }, { slot: "asc" }],
  });

  return ok(plans);
});

export const POST = withErrorHandling(async (req) => {
  const body = createSchema.parse(await req.json());

  const family = await db.family.findFirst();
  if (!family) {
    throw new AppError(
      "Create a family before adding meal plans",
      "FAMILY_NOT_FOUND",
      400,
    );
  }

  if (body.recipeId) {
    const recipe = await db.recipe.findUnique({
      where: { id: body.recipeId },
    });
    if (!recipe || recipe.familyId !== family.id) {
      throw new AppError("Recipe not found", "RECIPE_NOT_FOUND", 404);
    }
  }

  if (body.memberId) {
    const member = await db.member.findUnique({
      where: { id: body.memberId },
    });
    if (!member || member.familyId !== family.id) {
      throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);
    }
  }

  const plan = await db.mealPlan.upsert({
    where: {
      familyId_date_slot: {
        familyId: family.id,
        date: body.date,
        slot: body.slot,
      },
    },
    create: {
      familyId: family.id,
      date: body.date,
      slot: body.slot,
      recipeId: body.recipeId ?? null,
      customName: body.customName ?? null,
      notes: body.notes ?? null,
      memberId: body.memberId ?? null,
    },
    update: {
      recipeId: body.recipeId ?? null,
      customName: body.customName ?? null,
      notes: body.notes ?? null,
      memberId: body.memberId ?? null,
    },
    include: {
      recipe: { select: { id: true, name: true, imageUrl: true } },
      member: { select: { id: true, name: true, color: true } },
    },
  });

  // Fire-and-forget — don't delay the response for push delivery.
  void (async () => {
    const { t } = await getNotificationTranslator();
    const mealName =
      plan.recipe?.name ??
      plan.customName ??
      t("notifications.mealCreate.fallback");
    await sendNotificationToFamily(family.id, {
      title: t("notifications.mealCreate.title"),
      body: mealName,
      url: "/meals",
      tag: `meal-plan-${plan.id}`,
    });
  })().catch(() => {
    // Swallow silently — no subscriptions yet or push service unavailable.
  });

  return ok(plan);
});

import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { MEAL_SLOTS } from "@/lib/enums";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { sendNotificationToFamily } from "@/lib/notifications";
import { getNotificationTranslator } from "@/lib/notification-i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  const day = out.getUTCDay(); // 0=Sun … 6=Sat
  out.setUTCDate(out.getUTCDate() + (day === 0 ? -6 : 1 - day));
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

type PlanWithRelations = {
  id: string;
  date: Date;
  slot: string;
  customName: string | null;
  notes: string | null;
  recipe: { id: string; name: string; imageUrl: string | null } | null;
  member: { id: string; name: string; color: string } | null;
};

function serializePlan(plan: PlanWithRelations) {
  return {
    id: plan.id,
    date: plan.date.toISOString(),
    slot: plan.slot,
    customName: plan.customName,
    notes: plan.notes,
    recipe: plan.recipe,
    member: plan.member,
  };
}

const createSchema = z.object({
  date: z.coerce.date(),
  slot: z.enum(MEAL_SLOTS),
  customName: z.string().trim().min(1).max(200),
  notes: z.string().max(1000).optional().nullable(),
  memberId: z.string().min(1).optional().nullable(),
});

export const GET = withErrorHandling(async (req) => {
  const ctx = await requireMobileAuth(req);

  const { searchParams } = new URL(req.url);
  const weekParam = searchParams.get("week");

  const anchor = weekParam ? new Date(weekParam) : new Date();
  // Fall back to today if the param is not a valid date string
  const from = startOfWeek(isNaN(anchor.getTime()) ? new Date() : anchor);
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 7);

  const plans = await db.mealPlan.findMany({
    where: { familyId: ctx.familyId, date: { gte: from, lt: to } },
    include: {
      recipe: { select: { id: true, name: true, imageUrl: true } },
      member: { select: { id: true, name: true, color: true } },
    },
    orderBy: [{ date: "asc" }, { slot: "asc" }],
  });

  return ok({ plans: plans.map(serializePlan) });
});

export const POST = withErrorHandling(async (req) => {
  const ctx = await requireMobileAuth(req);
  const body = createSchema.parse(await req.json());

  if (body.memberId) {
    const member = await db.member.findUnique({ where: { id: body.memberId } });
    if (!member || member.familyId !== ctx.familyId) {
      throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);
    }
  }

  const plan = await db.mealPlan.upsert({
    where: {
      familyId_date_slot: {
        familyId: ctx.familyId,
        date: body.date,
        slot: body.slot,
      },
    },
    create: {
      familyId: ctx.familyId,
      date: body.date,
      slot: body.slot,
      recipeId: null,
      customName: body.customName,
      notes: body.notes ?? null,
      memberId: body.memberId ?? null,
    },
    update: {
      recipeId: null,
      customName: body.customName,
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
    await sendNotificationToFamily(ctx.familyId, {
      title: t("notifications.mealCreate.title"),
      body: mealName,
      url: "/meals",
      tag: `meal-plan-${plan.id}`,
    });
  })().catch(() => {
    // Swallow silently — no subscriptions yet or push service unavailable.
  });

  return ok(serializePlan(plan));
});

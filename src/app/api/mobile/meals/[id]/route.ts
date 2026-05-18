import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { MEAL_SLOTS } from "@/lib/enums";
import { requireMobileAuth } from "@/lib/mobile-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSchema = z
  .object({
    date: z.coerce.date().optional(),
    slot: z.enum(MEAL_SLOTS).optional(),
    customName: z.string().trim().min(1).max(200).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
    memberId: z.string().min(1).optional().nullable(),
  })
  .refine(
    (d) => {
      const hasCustom = d.customName !== undefined;
      if (!hasCustom) return true;
      return d.customName != null;
    },
    {
      message: "Cannot clear customName",
      path: ["customName"],
    },
  );

type Ctx = { params: Promise<{ id: string }> };

async function getPlanOrThrow(id: string, familyId: string) {
  const plan = await db.mealPlan.findUnique({ where: { id } });
  if (!plan || plan.familyId !== familyId) {
    throw new AppError("Meal plan not found", "MEAL_PLAN_NOT_FOUND", 404);
  }
  return plan;
}

export const PATCH = withErrorHandling<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const ctx = await requireMobileAuth(req);
  await getPlanOrThrow(id, ctx.familyId);

  const body = updateSchema.parse(await req.json());

  if (body.memberId) {
    const member = await db.member.findUnique({ where: { id: body.memberId } });
    if (!member || member.familyId !== ctx.familyId) {
      throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);
    }
  }

  const updated = await db.mealPlan.update({
    where: { id },
    data: {
      ...(body.date !== undefined && { date: body.date }),
      ...(body.slot !== undefined && { slot: body.slot }),
      ...(body.customName !== undefined && { customName: body.customName }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.memberId !== undefined && { memberId: body.memberId }),
    },
    include: {
      recipe: { select: { id: true, name: true, imageUrl: true } },
      member: { select: { id: true, name: true, color: true } },
    },
  });

  return ok({
    id: updated.id,
    date: updated.date.toISOString(),
    slot: updated.slot,
    customName: updated.customName,
    notes: updated.notes,
    recipe: updated.recipe,
    member: updated.member,
  });
});

export const DELETE = withErrorHandling<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const ctx = await requireMobileAuth(req);
  await getPlanOrThrow(id, ctx.familyId);
  await db.mealPlan.delete({ where: { id } });
  return ok({ ok: true });
});

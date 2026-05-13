import { ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { requireMobileAuth } from "@/lib/mobile-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  const day = out.getUTCDay(); // 0=Sun … 6=Sat
  out.setUTCDate(out.getUTCDate() + (day === 0 ? -6 : 1 - day));
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

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

  const serialized = plans.map((plan) => ({
    id: plan.id,
    date: plan.date.toISOString(),
    slot: plan.slot,
    customName: plan.customName,
    notes: plan.notes,
    recipe: plan.recipe,
    member: plan.member,
  }));

  return ok({ plans: serialized });
});

import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { getWeeklyTotalsForMember } from "@/lib/queries";
import { sendNotificationToFamily } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function todayBoundaries(): { startOfToday: Date; endOfToday: Date } {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  );
  const endOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    0,
  );
  return { startOfToday, endOfToday };
}

export const POST = withErrorHandling<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const ctx = await requireMobileAuth(req);

  const chore = await db.chore.findUnique({
    where: { id },
    select: { id: true, familyId: true, title: true, points: true },
  });
  if (!chore || chore.familyId !== ctx.familyId) {
    throw new AppError("Chore not found", "CHORE_NOT_FOUND", 404);
  }

  const { startOfToday, endOfToday } = todayBoundaries();

  const existing = await db.choreCompletion.findFirst({
    where: {
      choreId: chore.id,
      memberId: ctx.memberId,
      completedAt: { gte: startOfToday, lt: endOfToday },
    },
  });

  if (existing) {
    const totals = await getWeeklyTotalsForMember(ctx.memberId);
    return ok({
      completionId: existing.id,
      choreId: chore.id,
      memberId: ctx.memberId,
      points: chore.points,
      completedToday: true,
      alreadyCompletedToday: true,
      weeklyPoints: totals.points,
    });
  }

  const completion = await db.choreCompletion.create({
    data: { choreId: chore.id, memberId: ctx.memberId },
  });

  const totals = await getWeeklyTotalsForMember(ctx.memberId);

  const member = await db.member.findUnique({
    where: { id: ctx.memberId },
    select: { name: true },
  });

  // Fire-and-forget: notification failure must not fail the mutation.
  void (async () => {
    try {
      await sendNotificationToFamily(ctx.familyId, {
        title: `Star earned — ${member?.name ?? "Someone"} finished ${chore.title}`,
        body: `+${chore.points} stars · ${totals.points} this week`,
        tag: `chore-complete-${chore.id}`,
      });
    } catch {
      // Intentionally swallowed — push is best-effort.
    }
  })();

  return ok({
    completionId: completion.id,
    choreId: chore.id,
    memberId: ctx.memberId,
    points: chore.points,
    completedToday: true,
    alreadyCompletedToday: false,
    weeklyPoints: totals.points,
  });
});

export const DELETE = withErrorHandling<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const ctx = await requireMobileAuth(req);

  const chore = await db.chore.findUnique({
    where: { id },
    select: { id: true, familyId: true },
  });
  if (!chore || chore.familyId !== ctx.familyId) {
    throw new AppError("Chore not found", "CHORE_NOT_FOUND", 404);
  }

  const { startOfToday, endOfToday } = todayBoundaries();

  const existing = await db.choreCompletion.findFirst({
    where: {
      choreId: chore.id,
      memberId: ctx.memberId,
      completedAt: { gte: startOfToday, lt: endOfToday },
    },
  });

  if (!existing) {
    return ok({ ok: true, undone: false });
  }

  await db.choreCompletion.delete({ where: { id: existing.id } });
  return ok({ ok: true, undone: true });
});

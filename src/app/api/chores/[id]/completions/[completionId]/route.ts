import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { getWeeklyTotalsForMember } from "@/lib/queries";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; completionId: string }> };

export const DELETE = withErrorHandling<Ctx>(async (_req, { params }) => {
  const { id, completionId } = await params;

  const chore = await db.chore.findUnique({
    where: { id },
    select: { id: true, familyId: true },
  });
  if (!chore) throw new AppError("Chore not found", "CHORE_NOT_FOUND", 404);

  const completion = await db.choreCompletion.findUnique({
    where: { id: completionId },
    include: { member: { select: { familyId: true } } },
  });
  if (
    !completion ||
    completion.choreId !== chore.id ||
    completion.member.familyId !== chore.familyId
  ) {
    throw new AppError(
      "Completion not found",
      "COMPLETION_NOT_FOUND",
      404,
    );
  }

  const memberId = completion.memberId;

  await db.choreCompletion.delete({ where: { id: completionId } });

  const totals = await getWeeklyTotalsForMember(memberId);

  return ok({
    ok: true,
    weeklyPoints: totals.points,
    weeklyCompletions: totals.completions,
  });
});

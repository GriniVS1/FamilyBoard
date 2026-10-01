import type { PointResetUndoResponse } from "@/components/chores/types";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { runExclusive } from "@/lib/points";
import { getPointsBalances } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = withErrorHandling<Ctx>(async (_req, { params }) => {
  const { id } = await params;

  const result = await runExclusive(() =>
    db.$transaction(async (tx) => {
      const reset = await tx.pointReset.findUnique({
        where: { id },
        select: {
          id: true,
          memberId: true,
          member: { select: { familyId: true } },
        },
      });
      if (!reset) {
        throw new AppError("Reset not found", "RESET_NOT_FOUND", 404);
      }

      const newest = await tx.pointReset.findFirst({
        where: { memberId: reset.memberId },
        orderBy: [{ resetAt: "desc" }, { id: "desc" }],
        select: { id: true },
      });
      if (newest?.id !== reset.id) {
        throw new AppError(
          "Only the most recent reset of a member can be undone",
          "RESET_NOT_LATEST",
          409,
        );
      }

      await tx.pointReset.delete({ where: { id: reset.id } });

      const balances = await getPointsBalances(tx, reset.member.familyId, {
        memberIds: [reset.memberId],
      });
      return {
        memberId: reset.memberId,
        balance: balances.get(reset.memberId)?.balance ?? 0,
      };
    }),
  );

  return ok<PointResetUndoResponse>({ ok: true, ...result });
});

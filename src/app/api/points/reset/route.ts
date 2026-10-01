import { z } from "zod";
import type { PointResetResponse } from "@/components/chores/types";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { runExclusive } from "@/lib/points";
import { getPointsBalances } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  memberIds: z.array(z.string().min(1)).min(1).max(50),
});

export const POST = withErrorHandling(async (req) => {
  const { memberIds: requested } = bodySchema.parse(await req.json());
  const memberIds = [...new Set(requested)];

  const family = await db.family.findFirst();
  const members = family
    ? await db.member.findMany({
        where: { familyId: family.id, id: { in: memberIds } },
        select: { id: true },
      })
    : [];
  if (!family || members.length !== memberIds.length) {
    throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);
  }

  const resets = await runExclusive(() =>
    db.$transaction(async (tx) => {
      const resetAt = new Date();
      const balances = await getPointsBalances(tx, family.id, {
        memberIds,
        until: resetAt,
      });

      const created: PointResetResponse["resets"] = [];
      for (const memberId of memberIds) {
        const balance = balances.get(memberId)?.balance ?? 0;
        if (balance === 0) continue;
        const row = await tx.pointReset.create({
          data: { memberId, points: balance, resetAt },
        });
        created.push({
          id: row.id,
          memberId: row.memberId,
          points: row.points,
          resetAt: row.resetAt.toISOString(),
        });
      }
      return created;
    }),
  );

  return ok<PointResetResponse>({ resets });
});

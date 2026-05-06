import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { getWeeklyTotalsForMember } from "@/lib/queries";

export const runtime = "nodejs";

const bodySchema = z.object({
  memberId: z.string().min(1),
});

type Ctx = { params: Promise<{ id: string }> };

export const POST = withErrorHandling<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const { memberId } = bodySchema.parse(await req.json());

  const chore = await db.chore.findUnique({ where: { id } });
  if (!chore) throw new AppError("Chore not found", "CHORE_NOT_FOUND", 404);

  const member = await db.member.findUnique({ where: { id: memberId } });
  if (!member) throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);

  if (member.familyId !== chore.familyId) {
    throw new AppError(
      "Member does not belong to this family",
      "MEMBER_FAMILY_MISMATCH",
      400,
    );
  }

  const completion = await db.choreCompletion.create({
    data: {
      choreId: chore.id,
      memberId: member.id,
    },
  });

  const totals = await getWeeklyTotalsForMember(member.id);

  return ok({
    completion,
    weeklyPoints: totals.points,
    weeklyCompletions: totals.completions,
  });
});

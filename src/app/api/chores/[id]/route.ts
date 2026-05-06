import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const patchSchema = z.object({
  memberId: z.string().min(1).nullable().optional(),
  title: z.string().trim().min(1).max(100).optional(),
  icon: z.string().max(8).nullable().optional(),
  points: z.number().int().min(1).max(50).optional(),
  rrule: z.string().max(200).nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandling<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const body = patchSchema.parse(await req.json());

  const chore = await db.chore.findUnique({ where: { id } });
  if (!chore) throw new AppError("Chore not found", "CHORE_NOT_FOUND", 404);

  if (body.memberId !== undefined && body.memberId !== null) {
    const member = await db.member.findUnique({
      where: { id: body.memberId },
    });
    if (!member || member.familyId !== chore.familyId) {
      throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);
    }
  }

  const updated = await db.chore.update({
    where: { id },
    data: {
      memberId: body.memberId,
      title: body.title,
      icon: body.icon,
      points: body.points,
      rrule: body.rrule,
    },
    select: {
      id: true,
      familyId: true,
      memberId: true,
      title: true,
      icon: true,
      points: true,
      rrule: true,
      createdAt: true,
    },
  });

  return ok(updated);
});

export const DELETE = withErrorHandling<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const chore = await db.chore.findUnique({ where: { id } });
  if (!chore) throw new AppError("Chore not found", "CHORE_NOT_FOUND", 404);

  await db.chore.delete({ where: { id } });
  return ok({ ok: true });
});

import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { MEMBER_COLORS } from "@/lib/utils";

export const runtime = "nodejs";

const patchSchema = z.object({
  body: z.string().trim().min(1).max(2000).optional(),
  color: z.enum(MEMBER_COLORS).optional(),
  authorMemberId: z.string().min(1).nullable().optional(),
  pinned: z.boolean().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandling<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const body = patchSchema.parse(await req.json());

  const note = await db.note.findUnique({ where: { id } });
  if (!note) throw new AppError("Note not found", "NOTE_NOT_FOUND", 404);

  if (body.authorMemberId !== undefined && body.authorMemberId !== null) {
    const member = await db.member.findUnique({
      where: { id: body.authorMemberId },
    });
    if (!member || member.familyId !== note.familyId) {
      throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);
    }
  }

  const updated = await db.note.update({
    where: { id },
    data: {
      body: body.body,
      color: body.color,
      authorMemberId: body.authorMemberId,
      pinned: body.pinned,
    },
  });

  return ok(updated);
});

export const DELETE = withErrorHandling<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const note = await db.note.findUnique({ where: { id } });
  if (!note) throw new AppError("Note not found", "NOTE_NOT_FOUND", 404);

  await db.note.delete({ where: { id } });
  return ok({ ok: true });
});

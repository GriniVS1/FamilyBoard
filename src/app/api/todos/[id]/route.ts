import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  memberId: z.string().min(1).nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  done: z.boolean().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandling<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const body = patchSchema.parse(await req.json());

  const todo = await db.todo.findUnique({ where: { id } });
  if (!todo) throw new AppError("Todo not found", "TODO_NOT_FOUND", 404);

  if (body.memberId !== undefined && body.memberId !== null) {
    const member = await db.member.findUnique({
      where: { id: body.memberId },
    });
    if (!member || member.familyId !== todo.familyId) {
      throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);
    }
  }

  const updated = await db.todo.update({
    where: { id },
    data: {
      title: body.title,
      memberId: body.memberId,
      dueDate: body.dueDate,
      done: body.done,
    },
  });

  return ok(updated);
});

export const DELETE = withErrorHandling<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const todo = await db.todo.findUnique({ where: { id } });
  if (!todo) throw new AppError("Todo not found", "TODO_NOT_FOUND", 404);

  await db.todo.delete({ where: { id } });
  return ok({ ok: true });
});

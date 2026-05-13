import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { requireMobileAuth } from "@/lib/mobile-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TODO_CAP = 200;

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  dueDate: z.coerce.date().nullable().optional(),
});

export const POST = withErrorHandling(async (req) => {
  const ctx = await requireMobileAuth(req);
  const body = createSchema.parse(await req.json());

  const count = await db.todo.count({ where: { familyId: ctx.familyId } });
  if (count >= TODO_CAP) {
    throw new AppError(
      "Family has reached the todo limit",
      "TOO_MANY_TODOS",
      400,
    );
  }

  const todo = await db.todo.create({
    data: {
      familyId: ctx.familyId,
      memberId: ctx.memberId,
      title: body.title,
      dueDate: body.dueDate ?? null,
    },
  });

  return ok(
    {
      id: todo.id,
      title: todo.title,
      done: todo.done,
      dueDate: todo.dueDate ? todo.dueDate.toISOString() : null,
      memberId: todo.memberId,
      familyId: todo.familyId,
      createdAt: todo.createdAt.toISOString(),
    },
    { status: 201 },
  );
});

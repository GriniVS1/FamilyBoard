import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { requireMobileAuth } from "@/lib/mobile-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    done: z.boolean().optional(),
    title: z.string().trim().min(1).max(200).optional(),
    dueDate: z.coerce.date().nullable().optional(),
  })
  .refine(
    (v) => v.done !== undefined || v.title !== undefined || v.dueDate !== undefined,
    { message: "At least one field must be provided" },
  );

type Ctx = { params: Promise<{ id: string }> };

async function resolveTodo(id: string, familyId: string) {
  const todo = await db.todo.findUnique({ where: { id } });
  if (!todo || todo.familyId !== familyId) {
    throw new AppError("Todo not found", "TODO_NOT_FOUND", 404);
  }
  return todo;
}

export const PATCH = withErrorHandling<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const ctx = await requireMobileAuth(req);

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    throw new AppError("Invalid JSON body", "VALIDATION_ERROR", 400);
  }

  const parsed = patchSchema.safeParse(rawBody);
  if (!parsed.success) {
    if (
      parsed.error.issues.some(
        (i) => i.path.length === 0 && i.code === "custom",
      )
    ) {
      throw new AppError(
        "At least one field must be provided",
        "NO_OP",
        400,
      );
    }
    throw parsed.error;
  }
  const body = parsed.data;

  await resolveTodo(id, ctx.familyId);

  const updated = await db.todo.update({
    where: { id },
    data: {
      title: body.title,
      dueDate: body.dueDate,
      done: body.done,
    },
  });

  return ok({
    id: updated.id,
    title: updated.title,
    done: updated.done,
    dueDate: updated.dueDate ? updated.dueDate.toISOString() : null,
    memberId: updated.memberId,
    familyId: updated.familyId,
    createdAt: updated.createdAt.toISOString(),
  });
});

export const DELETE = withErrorHandling<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const ctx = await requireMobileAuth(req);

  await resolveTodo(id, ctx.familyId);

  await db.todo.delete({ where: { id } });
  return ok({ ok: true });
});

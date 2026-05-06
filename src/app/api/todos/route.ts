import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  memberId: z.string().min(1).optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
});

export const GET = withErrorHandling(async () => {
  const family = await db.family.findFirst();
  if (!family) return ok([]);

  const todos = await db.todo.findMany({
    where: { familyId: family.id },
    orderBy: [{ done: "asc" }, { createdAt: "desc" }],
  });

  return ok(todos);
});

export const POST = withErrorHandling(async (req) => {
  const body = createSchema.parse(await req.json());

  const family = await db.family.findFirst();
  if (!family) {
    throw new AppError(
      "Create a family before adding todos",
      "FAMILY_NOT_FOUND",
      400,
    );
  }

  if (body.memberId) {
    const member = await db.member.findUnique({
      where: { id: body.memberId },
    });
    if (!member || member.familyId !== family.id) {
      throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);
    }
  }

  const todo = await db.todo.create({
    data: {
      familyId: family.id,
      memberId: body.memberId ?? null,
      title: body.title,
      dueDate: body.dueDate ?? null,
    },
  });

  return ok(todo);
});

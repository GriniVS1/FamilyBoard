import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { MEMBER_ROLE } from "@/lib/enums";
import { MEMBER_COLORS } from "@/lib/utils";
import { requireAdminPin } from "@/lib/admin-pin";

export const runtime = "nodejs";

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(40).optional(),
    color: z.enum(MEMBER_COLORS).optional(),
    emoji: z.string().max(4).nullable().optional(),
    role: z.enum(MEMBER_ROLE).optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.color !== undefined ||
      v.emoji !== undefined ||
      v.role !== undefined,
    { message: "At least one field must be provided" },
  );

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandling<Ctx>(async (req, { params }) => {
  await requireAdminPin(req);
  const { id } = await params;
  const body = patchSchema.parse(await req.json());

  const member = await db.member.findUnique({ where: { id } });
  if (!member) throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);

  if (body.role && body.role !== member.role && member.role === "ADMIN") {
    const adminCount = await db.member.count({
      where: { familyId: member.familyId, role: "ADMIN" },
    });
    if (adminCount <= 1) {
      throw new AppError(
        "Cannot demote the only admin",
        "LAST_ADMIN",
        400,
      );
    }
  }

  const updated = await db.member.update({
    where: { id },
    data: {
      name: body.name,
      color: body.color,
      emoji: body.emoji,
      role: body.role,
    },
  });

  return ok(updated);
});

export const DELETE = withErrorHandling<Ctx>(async (_req, { params }) => {
  await requireAdminPin(_req);
  const { id } = await params;
  const member = await db.member.findUnique({ where: { id } });
  if (!member) throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);

  const totalCount = await db.member.count({
    where: { familyId: member.familyId },
  });
  if (totalCount <= 1) {
    throw new AppError(
      "Cannot remove the only member",
      "LAST_MEMBER",
      400,
    );
  }

  if (member.role === "ADMIN") {
    const adminCount = await db.member.count({
      where: { familyId: member.familyId, role: "ADMIN" },
    });
    if (adminCount <= 1) {
      throw new AppError(
        "Cannot remove the only admin",
        "LAST_ADMIN",
        400,
      );
    }
  }

  await db.member.delete({ where: { id } });
  return ok({ ok: true });
});

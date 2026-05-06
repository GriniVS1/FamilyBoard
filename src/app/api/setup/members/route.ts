import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { MEMBER_ROLE } from "@/lib/enums";
import { listMembers } from "@/lib/queries";
import { MEMBER_COLORS } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const memberSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.enum(MEMBER_COLORS),
  emoji: z.string().max(4).optional(),
  role: z.enum(MEMBER_ROLE).optional(),
});

const bodySchema = z.object({
  members: z.array(memberSchema).min(1).max(8),
});

export const GET = withErrorHandling(async () => {
  const members = await listMembers();
  return ok(members);
});

export const POST = withErrorHandling(async (req) => {
  const json = await req.json();
  const { members } = bodySchema.parse(json);

  const family = await db.family.findFirst();
  if (!family) {
    throw new AppError(
      "Create a family before adding members",
      "FAMILY_NOT_FOUND",
      400,
    );
  }

  const existingAdmin = await db.member.findFirst({
    where: { familyId: family.id, role: "ADMIN" },
  });

  const normalized = members.map((m, idx) => {
    const role =
      m.role ?? (idx === 0 && !existingAdmin ? "ADMIN" : "MEMBER");
    return { ...m, role };
  });

  if (!existingAdmin && !normalized.some((m) => m.role === "ADMIN")) {
    normalized[0].role = "ADMIN";
  }

  const created = await db.$transaction(
    normalized.map((m) =>
      db.member.create({
        data: {
          familyId: family.id,
          name: m.name,
          color: m.color,
          emoji: m.emoji,
          role: m.role,
        },
      }),
    ),
  );

  return ok(created);
});

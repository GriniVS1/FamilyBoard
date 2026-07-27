import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { getChoresForFamily } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async (req) => {
  const ctx = await requireMobileAuth(req);
  const chores = await getChoresForFamily(ctx.familyId);
  return ok({ chores });
});

// Mirrors the wall's POST /api/chores create shape. memberId may be any family
// member (e.g. a child) — that's the point: a parent assigns chores to the kids
// from the phone. Gated to ADMIN so a child's paired device can't mint chores.
const createSchema = z.object({
  memberId: z.string().min(1).optional().nullable(),
  title: z.string().trim().min(1).max(100),
  icon: z.string().max(8).optional().nullable(),
  points: z.number().int().min(1).max(50).optional().default(1),
  rrule: z.string().max(200).optional().nullable(),
});

export const POST = withErrorHandling(async (req) => {
  const auth = await requireMobileAuth(req);
  if (auth.role !== "ADMIN") {
    throw new AppError("Only an admin can create chores", "FORBIDDEN", 403);
  }

  const body = createSchema.parse(await req.json());

  const family = await db.family.findFirst({ select: { id: true } });
  if (!family) {
    throw new AppError("Family not found", "FAMILY_NOT_FOUND", 400);
  }

  if (body.memberId) {
    const member = await db.member.findUnique({
      where: { id: body.memberId },
      select: { familyId: true },
    });
    if (!member || member.familyId !== family.id) {
      throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);
    }
  }

  const chore = await db.chore.create({
    data: {
      familyId: family.id,
      memberId: body.memberId ?? null,
      title: body.title,
      icon: body.icon ?? null,
      points: body.points,
      rrule: body.rrule ?? null,
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

  return ok(chore);
});

import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { MEMBER_COLORS } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  color: z.enum(MEMBER_COLORS),
  authorMemberId: z.string().min(1).optional().nullable(),
  pinned: z.boolean().optional().default(false),
});

export const GET = withErrorHandling(async () => {
  const family = await db.family.findFirst();
  if (!family) return ok([]);

  const notes = await db.note.findMany({
    where: { familyId: family.id },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });

  return ok(notes);
});

export const POST = withErrorHandling(async (req) => {
  const body = createSchema.parse(await req.json());

  const family = await db.family.findFirst();
  if (!family) {
    throw new AppError(
      "Create a family before adding notes",
      "FAMILY_NOT_FOUND",
      400,
    );
  }

  if (body.authorMemberId) {
    const member = await db.member.findUnique({
      where: { id: body.authorMemberId },
    });
    if (!member || member.familyId !== family.id) {
      throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);
    }
  }

  const note = await db.note.create({
    data: {
      familyId: family.id,
      authorMemberId: body.authorMemberId ?? null,
      body: body.body,
      color: body.color,
      pinned: body.pinned ?? false,
    },
  });

  return ok(note);
});

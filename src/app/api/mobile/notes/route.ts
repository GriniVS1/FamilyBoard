import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { MEMBER_COLORS } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOTE_CAP = 200;

const NOTE_SELECT = {
  id: true,
  familyId: true,
  authorMemberId: true,
  body: true,
  color: true,
  pinned: true,
  createdAt: true,
  author: {
    select: { id: true, name: true, color: true, emoji: true },
  },
} as const;

function serializeNote(
  note: Awaited<ReturnType<typeof db.note.findMany>>[number] & {
    author: { id: string; name: string; color: string; emoji: string | null } | null;
  },
) {
  return {
    id: note.id,
    familyId: note.familyId,
    authorMemberId: note.authorMemberId,
    body: note.body,
    color: note.color,
    pinned: note.pinned,
    createdAt: note.createdAt.toISOString(),
    author: note.author
      ? {
          id: note.author.id,
          name: note.author.name,
          color: note.author.color,
          emoji: note.author.emoji,
        }
      : null,
  };
}

const createSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  color: z.enum(MEMBER_COLORS).default("sun"),
  pinned: z.boolean().default(false),
});

export const GET = withErrorHandling(async (req) => {
  const ctx = await requireMobileAuth(req);

  const notes = await db.note.findMany({
    where: { familyId: ctx.familyId },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: NOTE_CAP,
    select: NOTE_SELECT,
  });

  return ok({ notes: notes.map(serializeNote) });
});

export const POST = withErrorHandling(async (req) => {
  const ctx = await requireMobileAuth(req);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new AppError("Invalid JSON body", "VALIDATION_ERROR", 400);
  }

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    const colorIssue = parsed.error.issues.some(
      (i) => i.path[0] === "color",
    );
    if (colorIssue) {
      throw new AppError(
        `color must be one of: ${MEMBER_COLORS.join(", ")}`,
        "INVALID_COLOR",
        400,
      );
    }
    throw parsed.error;
  }
  const body = parsed.data;

  const count = await db.note.count({ where: { familyId: ctx.familyId } });
  if (count >= NOTE_CAP) {
    throw new AppError(
      "Family has reached the notes limit",
      "TOO_MANY_NOTES",
      400,
    );
  }

  const note = await db.note.create({
    data: {
      familyId: ctx.familyId,
      authorMemberId: ctx.memberId,
      body: body.body,
      color: body.color,
      pinned: body.pinned,
    },
    select: NOTE_SELECT,
  });

  return ok(serializeNote(note), { status: 201 });
});

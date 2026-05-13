import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { MEMBER_COLORS } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  note: Awaited<ReturnType<typeof db.note.findUnique>> & {
    author: { id: string; name: string; color: string; emoji: string | null } | null;
  },
) {
  if (!note) throw new AppError("Note not found", "NOTE_NOT_FOUND", 404);
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

async function resolveNote(id: string, familyId: string) {
  const note = await db.note.findUnique({ where: { id } });
  if (!note || note.familyId !== familyId) {
    throw new AppError("Note not found", "NOTE_NOT_FOUND", 404);
  }
  return note;
}

const patchSchema = z
  .object({
    body: z.string().trim().min(1).max(2000).optional(),
    color: z.enum(MEMBER_COLORS).optional(),
    pinned: z.boolean().optional(),
  })
  .refine(
    (v) => v.body !== undefined || v.color !== undefined || v.pinned !== undefined,
    { message: "At least one field must be provided" },
  );

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandling<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const ctx = await requireMobileAuth(req);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new AppError("Invalid JSON body", "VALIDATION_ERROR", 400);
  }

  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    const noOpIssue = parsed.error.issues.some(
      (i) => i.path.length === 0 && i.code === "custom",
    );
    if (noOpIssue) {
      throw new AppError("At least one field must be provided", "NO_OP", 400);
    }
    const colorIssue = parsed.error.issues.some((i) => i.path[0] === "color");
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

  await resolveNote(id, ctx.familyId);

  const updated = await db.note.update({
    where: { id },
    data: {
      body: body.body,
      color: body.color,
      pinned: body.pinned,
    },
    select: NOTE_SELECT,
  });

  return ok(serializeNote(updated));
});

export const DELETE = withErrorHandling<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const ctx = await requireMobileAuth(req);

  await resolveNote(id, ctx.familyId);

  await db.note.delete({ where: { id } });
  return ok({ ok: true });
});

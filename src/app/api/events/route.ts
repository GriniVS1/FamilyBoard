import { z } from "zod";
import { withErrorHandling, ok, AppError } from "@/lib/api";
import { db } from "@/lib/db";
import { pushLocalEvent } from "@/lib/sync";

export const runtime = "nodejs";

const createSchema = z.object({
  memberId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  allDay: z.boolean().optional().default(false),
  color: z.string().max(20).optional().nullable(),
});

export const GET = withErrorHandling(async (req) => {
  const url = new URL(req.url);
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const memberIdsStr = url.searchParams.get("memberIds");

  if (!fromStr || !toStr) {
    throw new AppError("from and to are required", "MISSING_RANGE", 400);
  }
  const from = new Date(fromStr);
  const to = new Date(toStr);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new AppError("from/to must be ISO datetimes", "INVALID_RANGE", 400);
  }

  const memberIds = memberIdsStr
    ? memberIdsStr.split(",").map((s) => s.trim()).filter(Boolean)
    : null;

  const events = await db.event.findMany({
    where: {
      ...(memberIds ? { memberId: { in: memberIds } } : {}),
      startsAt: { lt: to },
      endsAt: { gte: from },
    },
    orderBy: { startsAt: "asc" },
  });

  return ok(events);
});

export const POST = withErrorHandling(async (req) => {
  const body = createSchema.parse(await req.json());
  if (body.endsAt <= body.startsAt) {
    throw new AppError("endsAt must be after startsAt", "INVALID_RANGE", 400);
  }

  const member = await db.member.findUnique({ where: { id: body.memberId } });
  if (!member) throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);

  const event = await db.event.create({
    data: {
      familyId: member.familyId,
      memberId: member.id,
      title: body.title,
      description: body.description ?? null,
      location: body.location ?? null,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      allDay: body.allDay,
      source: "LOCAL",
      color: body.color ?? null,
    },
  });

  if (member.googleSyncEnabled && member.googleRefreshTokenEnc) {
    try {
      await pushLocalEvent(event.id);
    } catch (err) {
      console.warn(
        "[events] push to Google failed",
        err instanceof Error ? err.message : err,
      );
    }
  }

  const fresh = await db.event.findUnique({ where: { id: event.id } });
  return ok(fresh);
});

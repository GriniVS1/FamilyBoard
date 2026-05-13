import { z } from "zod";
import { ok, AppError, withErrorHandling } from "@/lib/api";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENT_CAP = 500;

const querySchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  memberIds: z.string().optional(),
});

export const GET = withErrorHandling(async (req) => {
  const ctx = await requireMobileAuth(req);

  const url = new URL(req.url);
  const rawQuery = querySchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    memberIds: url.searchParams.get("memberIds") ?? undefined,
  });

  if (!rawQuery.success) {
    throw new AppError("from and to are required", "MISSING_RANGE", 400);
  }

  const from = new Date(rawQuery.data.from);
  const to = new Date(rawQuery.data.to);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new AppError("from/to must be ISO datetimes", "INVALID_RANGE", 400);
  }

  const memberIds = rawQuery.data.memberIds
    ? rawQuery.data.memberIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : null;

  // Count first to enforce cap before fetching full rows + includes.
  const count = await db.event.count({
    where: {
      familyId: ctx.familyId,
      ...(memberIds ? { memberId: { in: memberIds } } : {}),
      startsAt: { lt: to },
      endsAt: { gte: from },
    },
  });

  if (count > EVENT_CAP) {
    throw new AppError(
      `Query would return ${count} events (cap is ${EVENT_CAP}). Narrow the date range.`,
      "RANGE_TOO_BROAD",
      400,
    );
  }

  const rows = await db.event.findMany({
    where: {
      familyId: ctx.familyId,
      ...(memberIds ? { memberId: { in: memberIds } } : {}),
      startsAt: { lt: to },
      endsAt: { gte: from },
    },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      location: true,
      startsAt: true,
      endsAt: true,
      allDay: true,
      color: true,
      source: true,
      member: {
        select: {
          id: true,
          name: true,
          color: true,
          emoji: true,
        },
      },
    },
  });

  return ok({ events: rows });
});

import { z } from "zod";
import { ok, AppError, withErrorHandling } from "@/lib/api";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { fetchExpandedEventRows } from "@/lib/events-read";
import {
  createEvent,
  createEventSchema,
  getMobileEvent,
} from "@/lib/events-write";

type MobileEventMember = {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
};

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

  const expanded = await fetchExpandedEventRows<{ member: MobileEventMember }>(
    { from, to, familyId: ctx.familyId, memberIds },
    {
      overrides: true,
      member: { select: { id: true, name: true, color: true, emoji: true } },
    },
    EVENT_CAP,
  );

  const events = expanded.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    location: e.location,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    allDay: e.allDay,
    color: e.color,
    source: e.source,
    member: e.member,
  }));

  return ok({ events });
});

export const POST = withErrorHandling(async (req) => {
  const ctx = await requireMobileAuth(req);
  const body = createEventSchema.parse(await req.json());

  const event = await createEvent(body, { familyId: ctx.familyId });
  const mobileEvent = await getMobileEvent(event.id);
  return ok({ event: mobileEvent }, { status: 201 });
});

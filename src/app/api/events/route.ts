import { z } from "zod";
import { withErrorHandling, ok, AppError } from "@/lib/api";
import { db } from "@/lib/db";
import { pushLocalEvent } from "@/lib/sync";
import { pushLocalEventToCaldav } from "@/lib/caldav";
import { pushLocalEventToMicrosoft } from "@/lib/microsoft";
import { sendNotificationToFamily } from "@/lib/notifications";
import { getNotificationTranslator } from "@/lib/notification-i18n";
import { expandEventsInRange } from "@/lib/event-expansion";
import { rruleSchema } from "@/lib/rrule";

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
  rrule: rruleSchema.optional().nullable(),
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

  // Fetch non-recurring events that fall within the window, plus any
  // recurring events whose series starts at or before the window end
  // (they may still produce occurrences within the window).
  const rows = await db.event.findMany({
    where: {
      ...(memberIds ? { memberId: { in: memberIds } } : {}),
      OR: [
        // Normal events overlapping [from, to)
        {
          rrule: null,
          startsAt: { lt: to },
          endsAt: { gte: from },
        },
        // Recurring series that could still have occurrences inside the window
        {
          rrule: { not: null },
          startsAt: { lte: to },
        },
      ],
    },
  });

  const expanded = expandEventsInRange(rows, from, to);

  // Post-expansion filter: keep only occurrences that actually overlap [from, to).
  const filtered = expanded.filter(
    (e) => e.endsAt >= from && e.startsAt < to,
  );

  filtered.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  return ok(filtered);
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
      rrule: body.rrule ?? null,
    },
  });

  // Google supports recurring events — push regardless of rrule.
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

  // CalDAV supports recurring events — push regardless of rrule.
  // Microsoft recurrence push is out of scope (Graph uses a structured object,
  // not an iCal string — different slice).
  if (member.caldavSyncEnabled && member.caldavPasswordEnc) {
    void pushLocalEventToCaldav(event.id).catch((err) => {
      console.warn(
        "[events] push to CalDAV failed",
        err instanceof Error ? err.message : err,
      );
    });
  }

  if (!event.rrule && member.microsoftSyncEnabled && member.microsoftRefreshTokenEnc) {
    void pushLocalEventToMicrosoft(event.id).catch((err) => {
      console.warn(
        "[events] push to Microsoft failed",
        err instanceof Error ? err.message : err,
      );
    });
  }

  // Fire-and-forget — don't delay the response for push delivery.
  void (async () => {
    const { t } = await getNotificationTranslator();
    await sendNotificationToFamily(member.familyId, {
      title: t("notifications.eventCreate.title", { title: event.title }),
      body: t("notifications.eventCreate.body"),
      url: "/calendar",
      tag: `new-event-${event.id}`,
    });
  })().catch(() => {
    // Swallow silently — no subscriptions yet or push service unavailable.
  });

  const fresh = await db.event.findUnique({ where: { id: event.id } });
  return ok(fresh);
});

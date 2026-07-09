import { z } from "zod";
import type { Event, EventOverride } from "@prisma/client";
import { AppError } from "./api";
import { db } from "./db";
import {
  deleteRemoteEvent,
  pushLocalEvent,
  pushOverrideToGoogle,
} from "./sync";
import {
  deleteRemoteCaldavEvent,
  pushLocalEventToCaldav,
  pushOverrideToCaldav,
} from "./caldav";
import {
  deleteRemoteMicrosoftEvent,
  pushLocalEventToMicrosoft,
  pushOverrideToMicrosoft,
} from "./microsoft";
import { sendNotificationToFamily } from "./notifications";
import { getNotificationTranslator } from "./notification-i18n";
import { rruleSchema } from "./rrule";

export const createEventSchema = z.object({
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
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = z.object({
  memberId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  allDay: z.boolean().optional(),
  color: z.string().max(20).nullable().optional(),
  rrule: rruleSchema.nullable().optional(),
});
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export const eventScopeSchema = z.enum(["instance", "series"]).optional();
export type EventScope = "instance" | "series" | undefined;

export type FamilyScopeOpts = { familyId?: string };

export function parseSyntheticId(rawId: string): {
  masterId: string;
  recurrenceId: string | null;
} {
  const sep = rawId.indexOf("__");
  if (sep === -1) return { masterId: rawId, recurrenceId: null };
  return { masterId: rawId.slice(0, sep), recurrenceId: rawId.slice(sep + 2) };
}

// Shape returned by GET /api/mobile/events, reused for mobile write responses
// so the app can insert/replace the row directly without a follow-up fetch.
export const MOBILE_EVENT_SELECT = {
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
} as const;

export async function getMobileEvent(id: string) {
  const event = await db.event.findUnique({
    where: { id },
    select: MOBILE_EVENT_SELECT,
  });
  if (!event) throw new AppError("Event not found", "EVENT_NOT_FOUND", 404);
  return event;
}

export async function createEvent(
  input: CreateEventInput,
  opts?: FamilyScopeOpts,
): Promise<Event> {
  if (input.endsAt <= input.startsAt) {
    throw new AppError("endsAt must be after startsAt", "INVALID_RANGE", 400);
  }

  const member = await db.member.findUnique({ where: { id: input.memberId } });
  if (!member || (opts?.familyId && member.familyId !== opts.familyId)) {
    throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);
  }

  const event = await db.event.create({
    data: {
      familyId: member.familyId,
      memberId: member.id,
      title: input.title,
      description: input.description ?? null,
      location: input.location ?? null,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      allDay: input.allDay,
      source: "LOCAL",
      color: input.color ?? null,
      rrule: input.rrule ?? null,
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

  // CalDAV + Microsoft both support recurring events — push regardless of rrule.
  if (member.caldavSyncEnabled && member.caldavPasswordEnc) {
    void pushLocalEventToCaldav(event.id).catch((err) => {
      console.warn(
        "[events] push to CalDAV failed",
        err instanceof Error ? err.message : err,
      );
    });
  }

  if (member.microsoftSyncEnabled && member.microsoftRefreshTokenEnc) {
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
  if (!fresh) throw new AppError("Event not found", "EVENT_NOT_FOUND", 404);
  return fresh;
}

export type EventOverridePayload = EventOverride & {
  id: string;
  seriesId: string;
  isRecurring: true;
};

export type UpdateEventResult =
  | { kind: "instance"; payload: EventOverridePayload }
  | { kind: "series"; event: Event };

export async function updateEvent(
  rawId: string,
  scope: EventScope,
  body: UpdateEventInput,
  opts?: FamilyScopeOpts,
): Promise<UpdateEventResult> {
  const { masterId, recurrenceId } = parseSyntheticId(rawId);

  // Default: synthetic ID → instance scope; plain master ID → series scope.
  const effectiveScope = scope ?? (recurrenceId ? "instance" : "series");

  if (effectiveScope === "instance" && recurrenceId) {
    const master = await db.event.findUnique({ where: { id: masterId } });
    if (!master || (opts?.familyId && master.familyId !== opts.familyId)) {
      throw new AppError("Event not found", "EVENT_NOT_FOUND", 404);
    }
    if (master.source !== "LOCAL") {
      throw new AppError(
        "Per-occurrence overrides are only supported for LOCAL-source events",
        "OVERRIDE_NOT_SUPPORTED",
        400,
      );
    }

    if (body.startsAt && body.endsAt && body.endsAt <= body.startsAt) {
      throw new AppError("endsAt must be after startsAt", "INVALID_RANGE", 400);
    }

    const override = await db.eventOverride.upsert({
      where: { masterId_recurrenceId: { masterId, recurrenceId } },
      update: {
        cancelled: false,
        ...(body.title !== undefined && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.location !== undefined && { location: body.location }),
        ...(body.startsAt !== undefined && { startsAt: body.startsAt }),
        ...(body.endsAt !== undefined && { endsAt: body.endsAt }),
        ...(body.allDay !== undefined && { allDay: body.allDay }),
        ...(body.color !== undefined && { color: body.color }),
      },
      create: {
        masterId,
        recurrenceId,
        cancelled: false,
        title: body.title ?? null,
        description: body.description ?? null,
        location: body.location ?? null,
        startsAt: body.startsAt ?? null,
        endsAt: body.endsAt ?? null,
        allDay: body.allDay ?? null,
        color: body.color ?? null,
      },
    });

    // Fire-and-forget remote override pushes — same posture as series-scope pushes.
    const overrideMember = await db.member.findUnique({ where: { id: master.memberId } });
    if (overrideMember?.googleSyncEnabled && overrideMember.googleRefreshTokenEnc) {
      void pushOverrideToGoogle(masterId, recurrenceId).catch((err) => {
        console.warn(
          "[events] push override to Google failed",
          err instanceof Error ? err.message : err,
        );
      });
    }
    if (overrideMember?.caldavSyncEnabled && overrideMember.caldavPasswordEnc) {
      void pushOverrideToCaldav(masterId, recurrenceId).catch((err) => {
        console.warn(
          "[events] push override to CalDAV failed",
          err instanceof Error ? err.message : err,
        );
      });
    }
    if (overrideMember?.microsoftSyncEnabled && overrideMember.microsoftRefreshTokenEnc) {
      void pushOverrideToMicrosoft(masterId, recurrenceId).catch((err) => {
        console.warn(
          "[events] push override to Microsoft failed",
          err instanceof Error ? err.message : err,
        );
      });
    }

    return {
      kind: "instance",
      payload: { ...override, id: rawId, seriesId: masterId, isRecurring: true },
    };
  }

  // series scope — update master row
  const event = await db.event.findUnique({ where: { id: masterId } });
  if (!event || (opts?.familyId && event.familyId !== opts.familyId)) {
    throw new AppError("Event not found", "EVENT_NOT_FOUND", 404);
  }

  const isGoogle = event.source === "GOOGLE";
  const isMicrosoft = event.source === "MICROSOFT";

  if (isGoogle) {
    const allowed = new Set(["memberId", "color"]);
    for (const key of Object.keys(body)) {
      if (!allowed.has(key)) {
        throw new AppError(
          "Google-sourced events: only memberId and color can be edited",
          "GOOGLE_EVENT_READ_ONLY",
          400,
        );
      }
    }
  } else if (isMicrosoft) {
    const allowed = new Set(["memberId", "color"]);
    for (const key of Object.keys(body)) {
      if (!allowed.has(key)) {
        throw new AppError(
          "Microsoft-sourced events: only memberId and color can be edited",
          "MICROSOFT_EVENT_READ_ONLY",
          400,
        );
      }
    }
  } else if (body.startsAt && body.endsAt && body.endsAt <= body.startsAt) {
    throw new AppError("endsAt must be after startsAt", "INVALID_RANGE", 400);
  }

  if (body.memberId) {
    const member = await db.member.findUnique({ where: { id: body.memberId } });
    if (!member || (opts?.familyId && member.familyId !== opts.familyId)) {
      throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);
    }
  }

  // Shifting the series schedule makes existing per-occurrence overrides
  // semantically orphaned — purge them, matching Google Calendar's behavior.
  const scheduleChanged = body.rrule !== undefined || body.startsAt !== undefined;
  if (scheduleChanged && event.rrule) {
    await db.eventOverride.deleteMany({ where: { masterId } });
  }

  const updated = await db.event.update({
    where: { id: masterId },
    data: {
      memberId: body.memberId,
      title: body.title,
      description: body.description,
      location: body.location,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      allDay: body.allDay,
      color: body.color,
      rrule: body.rrule,
    },
  });

  // All three providers support recurring events — push unconditionally for LOCAL.
  if (!isGoogle && !isMicrosoft) {
    const member = await db.member.findUnique({ where: { id: updated.memberId } });
    if (member?.googleSyncEnabled && member.googleRefreshTokenEnc) {
      try {
        await pushLocalEvent(updated.id);
      } catch (err) {
        console.warn(
          "[events] push update to Google failed",
          err instanceof Error ? err.message : err,
        );
      }
    }
    if (member?.caldavSyncEnabled && member.caldavPasswordEnc) {
      void pushLocalEventToCaldav(updated.id).catch((err) => {
        console.warn(
          "[events] push update to CalDAV failed",
          err instanceof Error ? err.message : err,
        );
      });
    }
    if (member?.microsoftSyncEnabled && member.microsoftRefreshTokenEnc) {
      void pushLocalEventToMicrosoft(updated.id).catch((err) => {
        console.warn(
          "[events] push update to Microsoft failed",
          err instanceof Error ? err.message : err,
        );
      });
    }
  }

  const fresh = await db.event.findUnique({ where: { id: masterId } });
  if (!fresh) throw new AppError("Event not found", "EVENT_NOT_FOUND", 404);
  return { kind: "series", event: fresh };
}

export type DeleteEventResult = { kind: "instance" } | { kind: "series" };

export async function deleteEvent(
  rawId: string,
  scope: EventScope,
  opts?: FamilyScopeOpts,
): Promise<DeleteEventResult> {
  const { masterId, recurrenceId } = parseSyntheticId(rawId);

  // Default: synthetic ID → instance scope; plain master ID → series scope.
  const effectiveScope = scope ?? (recurrenceId ? "instance" : "series");

  if (effectiveScope === "instance" && recurrenceId) {
    const master = await db.event.findUnique({ where: { id: masterId } });
    if (!master || (opts?.familyId && master.familyId !== opts.familyId)) {
      throw new AppError("Event not found", "EVENT_NOT_FOUND", 404);
    }
    if (master.source !== "LOCAL") {
      throw new AppError(
        "Per-occurrence cancellations are only supported for LOCAL-source events",
        "OVERRIDE_NOT_SUPPORTED",
        400,
      );
    }

    await db.eventOverride.upsert({
      where: { masterId_recurrenceId: { masterId, recurrenceId } },
      update: { cancelled: true },
      create: { masterId, recurrenceId, cancelled: true },
    });

    // Fire-and-forget cancellation pushes — load member once for all providers.
    const cancelMember = await db.member.findUnique({ where: { id: master.memberId } });
    if (cancelMember?.googleSyncEnabled && cancelMember.googleRefreshTokenEnc) {
      void pushOverrideToGoogle(masterId, recurrenceId).catch((err) => {
        console.warn(
          "[events] push cancellation to Google failed",
          err instanceof Error ? err.message : err,
        );
      });
    }
    if (cancelMember?.caldavSyncEnabled && cancelMember.caldavPasswordEnc) {
      void pushOverrideToCaldav(masterId, recurrenceId).catch((err) => {
        console.warn(
          "[events] push cancellation to CalDAV failed",
          err instanceof Error ? err.message : err,
        );
      });
    }
    if (cancelMember?.microsoftSyncEnabled && cancelMember.microsoftRefreshTokenEnc) {
      void pushOverrideToMicrosoft(masterId, recurrenceId).catch((err) => {
        console.warn(
          "[events] push cancellation to Microsoft failed",
          err instanceof Error ? err.message : err,
        );
      });
    }

    return { kind: "instance" };
  }

  // series scope — delete master row and any remote copies
  const event = await db.event.findUnique({ where: { id: masterId } });
  if (!event || (opts?.familyId && event.familyId !== opts.familyId)) {
    throw new AppError("Event not found", "EVENT_NOT_FOUND", 404);
  }

  if (event.source === "LOCAL" && event.googleEventId) {
    await deleteRemoteEvent(masterId);
  }
  if (event.source === "LOCAL" && event.caldavHref) {
    await deleteRemoteCaldavEvent(masterId);
  }
  if (event.source === "LOCAL" && event.microsoftEventId) {
    await deleteRemoteMicrosoftEvent(masterId);
  }
  // onDelete: Cascade on EventOverride.master handles override cleanup.
  await db.event.delete({ where: { id: masterId } });
  return { kind: "series" };
}

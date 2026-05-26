import { z } from "zod";
import { withErrorHandling, ok, AppError } from "@/lib/api";
import { db } from "@/lib/db";
import { deleteRemoteEvent, pushLocalEvent } from "@/lib/sync";
import { deleteRemoteCaldavEvent, pushLocalEventToCaldav } from "@/lib/caldav";
import { deleteRemoteMicrosoftEvent, pushLocalEventToMicrosoft } from "@/lib/microsoft";
import { rruleSchema } from "@/lib/rrule";

export const runtime = "nodejs";

const patchSchema = z.object({
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

const scopeSchema = z.enum(["instance", "series"]).optional();

function parseSyntheticId(rawId: string): { masterId: string; recurrenceId: string | null } {
  const sep = rawId.indexOf("__");
  if (sep === -1) return { masterId: rawId, recurrenceId: null };
  return { masterId: rawId.slice(0, sep), recurrenceId: rawId.slice(sep + 2) };
}

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandling<Ctx>(async (req, { params }) => {
  const { id: rawId } = await params;
  const url = new URL(req.url);
  const scopeRaw = url.searchParams.get("scope") ?? undefined;
  const scope = scopeSchema.parse(scopeRaw);
  const body = patchSchema.parse(await req.json());

  const { masterId, recurrenceId } = parseSyntheticId(rawId);

  // Default: synthetic ID → instance scope; plain master ID → series scope.
  const effectiveScope = scope ?? (recurrenceId ? "instance" : "series");

  if (effectiveScope === "instance" && recurrenceId) {
    const master = await db.event.findUnique({ where: { id: masterId } });
    if (!master) throw new AppError("Event not found", "EVENT_NOT_FOUND", 404);
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

    return ok({ ...override, id: rawId, seriesId: masterId, isRecurring: true });
  }

  // series scope — update master row
  const event = await db.event.findUnique({ where: { id: masterId } });
  if (!event) throw new AppError("Event not found", "EVENT_NOT_FOUND", 404);

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
    if (!member) throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);
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
  return ok(fresh);
});

export const DELETE = withErrorHandling<Ctx>(async (req, { params }) => {
  const { id: rawId } = await params;
  const url = new URL(req.url);
  const scopeRaw = url.searchParams.get("scope") ?? undefined;
  const scope = scopeSchema.parse(scopeRaw);

  const { masterId, recurrenceId } = parseSyntheticId(rawId);

  // Default: synthetic ID → instance scope; plain master ID → series scope.
  const effectiveScope = scope ?? (recurrenceId ? "instance" : "series");

  if (effectiveScope === "instance" && recurrenceId) {
    const master = await db.event.findUnique({ where: { id: masterId } });
    if (!master) throw new AppError("Event not found", "EVENT_NOT_FOUND", 404);
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

    return ok({ ok: true });
  }

  // series scope — delete master row and any remote copies
  const event = await db.event.findUnique({ where: { id: masterId } });
  if (!event) throw new AppError("Event not found", "EVENT_NOT_FOUND", 404);

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
  return ok({ ok: true });
});

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

// Synthetic occurrence IDs look like "<masterId>__<isoTimestamp>".
// Returns the master DB id by stripping the suffix.
function resolveMasterId(rawId: string): string {
  const sep = rawId.indexOf("__");
  return sep === -1 ? rawId : rawId.slice(0, sep);
}

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandling<Ctx>(async (req, { params }) => {
  const { id: rawId } = await params;
  const body = patchSchema.parse(await req.json());

  // Occurrence edits resolve to the master row (whole-series for Stage 1).
  const id = resolveMasterId(rawId);

  const event = await db.event.findUnique({ where: { id } });
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

  const updated = await db.event.update({
    where: { id },
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

  // All three providers (Google, CalDAV, Microsoft) support recurring events
  // now — push unconditionally for LOCAL-source events.
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

  const fresh = await db.event.findUnique({ where: { id } });
  return ok(fresh);
});

export const DELETE = withErrorHandling<Ctx>(async (_req, { params }) => {
  const { id: rawId } = await params;

  // Synthetic occurrence IDs → resolve to master row for whole-series delete (Stage 1).
  const id = resolveMasterId(rawId);

  const event = await db.event.findUnique({ where: { id } });
  if (!event) throw new AppError("Event not found", "EVENT_NOT_FOUND", 404);

  if (event.source === "LOCAL" && event.googleEventId) {
    await deleteRemoteEvent(id);
  }
  if (event.source === "LOCAL" && event.caldavHref) {
    await deleteRemoteCaldavEvent(id);
  }
  if (event.source === "LOCAL" && event.microsoftEventId) {
    await deleteRemoteMicrosoftEvent(id);
  }
  await db.event.delete({ where: { id } });
  return ok({ ok: true });
});

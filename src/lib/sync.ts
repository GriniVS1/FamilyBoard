import type { calendar_v3 } from "googleapis";
import { db } from "./db";
import { getCalendarForMember, isNotFoundLike, listIncrementalEvents } from "./google";
import { googleConfigured } from "./env";

export type SyncCounts = {
  pulled: number;
  pushed: number;
  deleted: number;
  skipped: number;
};

const ZERO: SyncCounts = { pulled: 0, pushed: 0, deleted: 0, skipped: 0 };

function add(a: SyncCounts, b: SyncCounts): SyncCounts {
  return {
    pulled: a.pulled + b.pulled,
    pushed: a.pushed + b.pushed,
    deleted: a.deleted + b.deleted,
    skipped: a.skipped + b.skipped,
  };
}

async function recordLastSync(memberId: string) {
  const iso = new Date().toISOString();
  await db.setting.upsert({
    where: { key: `last_sync_${memberId}` },
    update: { value: iso },
    create: { key: `last_sync_${memberId}`, value: iso },
  });
}

function parseGoogleDateTime(
  d: calendar_v3.Schema$EventDateTime | undefined,
): { date: Date; allDay: boolean } | null {
  if (!d) return null;
  if (d.dateTime) return { date: new Date(d.dateTime), allDay: false };
  if (d.date) {
    const [y, m, day] = d.date.split("-").map(Number);
    return { date: new Date(Date.UTC(y, m - 1, day)), allDay: true };
  }
  return null;
}

export async function pullForMember(memberId: string): Promise<SyncCounts> {
  if (!googleConfigured) return ZERO;
  const member = await db.member.findUnique({ where: { id: memberId } });
  if (!member || !member.googleSyncEnabled || !member.googleRefreshTokenEnc) {
    return ZERO;
  }

  const { events, nextSyncToken } = await listIncrementalEvents(memberId);

  let pulled = 0;
  let deleted = 0;
  let skipped = 0;

  for (const ev of events) {
    if (!ev.id) {
      skipped++;
      continue;
    }
    if (ev.status === "cancelled") {
      const res = await db.event.deleteMany({
        where: { memberId, googleEventId: ev.id },
      });
      if (res.count > 0) deleted++;
      continue;
    }

    // Skip expanded instances that belong to a series we own locally.
    // Without this guard, singleEvents:true would create N instance rows
    // alongside the local master row, doubling occurrences in the calendar view.
    if (ev.recurringEventId) {
      const localMaster = await db.event.findFirst({
        where: {
          memberId,
          googleEventId: ev.recurringEventId,
          rrule: { not: null },
        },
        select: { id: true },
      });
      if (localMaster) {
        skipped++;
        continue;
      }
    }

    const start = parseGoogleDateTime(ev.start ?? undefined);
    const end = parseGoogleDateTime(ev.end ?? undefined);
    if (!start || !end) {
      skipped++;
      continue;
    }

    await db.event.upsert({
      where: { memberId_googleEventId: { memberId, googleEventId: ev.id } },
      update: {
        title: ev.summary || "(no title)",
        description: ev.description ?? null,
        location: ev.location ?? null,
        startsAt: start.date,
        endsAt: end.date,
        allDay: start.allDay,
        source: "GOOGLE",
        googleCalendarId: "primary",
      },
      create: {
        familyId: member.familyId,
        memberId,
        title: ev.summary || "(no title)",
        description: ev.description ?? null,
        location: ev.location ?? null,
        startsAt: start.date,
        endsAt: end.date,
        allDay: start.allDay,
        source: "GOOGLE",
        googleEventId: ev.id,
        googleCalendarId: "primary",
      },
    });
    pulled++;
  }

  if (nextSyncToken) {
    await db.member.update({
      where: { id: memberId },
      data: { googleSyncToken: nextSyncToken },
    });
  }
  await recordLastSync(memberId);

  return { pulled, pushed: 0, deleted, skipped };
}

// Google requires UNTIL on all-day events to be DATE-only (no time component).
// The DB stores the datetime form unconditionally, so strip the suffix here only.
function normalizeRruleForGoogle(rrule: string, allDay: boolean): string {
  if (!allDay) return rrule;
  return rrule.replace(/UNTIL=(\d{8})T\d{6}Z/, "UNTIL=$1");
}

function toGoogleDateTime(date: Date, allDay: boolean): calendar_v3.Schema$EventDateTime {
  if (allDay) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return { date: `${y}-${m}-${d}` };
  }
  return { dateTime: date.toISOString() };
}

export async function pushLocalEvent(eventId: string): Promise<SyncCounts> {
  if (!googleConfigured) return ZERO;
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event || event.source !== "LOCAL") return ZERO;
  const member = await db.member.findUnique({ where: { id: event.memberId } });
  if (!member || !member.googleSyncEnabled || !member.googleRefreshTokenEnc) {
    return ZERO;
  }

  const calendar = await getCalendarForMember(member.id);
  const requestBody: calendar_v3.Schema$Event = {
    summary: event.title,
    description: event.description ?? undefined,
    location: event.location ?? undefined,
    start: toGoogleDateTime(event.startsAt, event.allDay),
    end: toGoogleDateTime(event.endsAt, event.allDay),
  };

  if (event.rrule) {
    requestBody.recurrence = [`RRULE:${normalizeRruleForGoogle(event.rrule, event.allDay)}`];
  } else if (event.googleEventId) {
    // rrule was removed — tell Google to clear the recurrence rule.
    requestBody.recurrence = [];
  }

  if (event.googleEventId) {
    await calendar.events.patch({
      calendarId: "primary",
      eventId: event.googleEventId,
      requestBody,
    });
    return { pulled: 0, pushed: 1, deleted: 0, skipped: 0 };
  }

  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody,
  });
  const remoteId = res.data.id;
  if (remoteId) {
    await db.event.update({
      where: { id: event.id },
      data: { googleEventId: remoteId, googleCalendarId: "primary" },
    });
  }
  return { pulled: 0, pushed: 1, deleted: 0, skipped: 0 };
}

export async function deleteRemoteEvent(eventId: string): Promise<void> {
  if (!googleConfigured) return;
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event || !event.googleEventId) return;
  const member = await db.member.findUnique({ where: { id: event.memberId } });
  if (!member || !member.googleRefreshTokenEnc) return;

  try {
    const calendar = await getCalendarForMember(member.id);
    await calendar.events.delete({
      calendarId: "primary",
      eventId: event.googleEventId,
    });
  } catch (err) {
    if (!isNotFoundLike(err)) {
      console.error(
        "[sync] remote delete failed",
        err instanceof Error ? err.message : err,
      );
    }
  }
}

export async function runGoogleSyncForAllMembers(): Promise<SyncCounts> {
  if (!googleConfigured) return ZERO;
  const members = await db.member.findMany({
    where: { googleSyncEnabled: true, googleRefreshTokenEnc: { not: null } },
  });
  let total: SyncCounts = ZERO;
  for (const m of members) {
    try {
      total = add(total, await pullForMember(m.id));
    } catch (err) {
      console.error(
        `[sync] member ${m.id} pull failed`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return total;
}

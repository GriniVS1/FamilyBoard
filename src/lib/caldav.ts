import "server-only";

import { DAVClient } from "tsdav";
import type { DAVCalendar } from "tsdav";
import ICAL from "ical.js";
import { randomUUID } from "node:crypto";
import { AppError } from "./api";
import { db } from "./db";
import { decryptToken, encryptToken } from "./crypto";
import { normalizeRruleForUntilDateOnly } from "./rrule";
import type { SyncCounts } from "./sync";

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export type CaldavPresetKey =
  | "icloud"
  | "fastmail"
  | "nextcloud"
  | "yahoo"
  | "custom";

export type CaldavPreset = {
  label: string;
  serverUrl?: string;
  helpUrl: string;
};

export const CALDAV_PRESETS: Record<CaldavPresetKey, CaldavPreset> = {
  icloud: {
    label: "Apple iCloud",
    serverUrl: "https://caldav.icloud.com",
    helpUrl: "https://support.apple.com/en-us/102489",
  },
  fastmail: {
    label: "Fastmail",
    serverUrl: "https://caldav.fastmail.com",
    helpUrl: "https://www.fastmail.help/hc/en-us/articles/1500000278342",
  },
  nextcloud: {
    label: "Nextcloud",
    // User must supply their own full URL — there is no shared server.
    serverUrl: undefined,
    helpUrl: "https://docs.nextcloud.com/server/latest/user_manual/en/groupware/calendar.html",
  },
  yahoo: {
    label: "Yahoo Calendar",
    serverUrl: "https://caldav.calendar.yahoo.com",
    // Yahoo requires an app-specific password from account.yahoo.com/security.
    helpUrl: "https://help.yahoo.com/kb/SLN15241.html",
  },
  custom: {
    label: "Custom CalDAV Server",
    serverUrl: undefined,
    helpUrl: "",
  },
};

// ---------------------------------------------------------------------------
// Calendar discovery
// ---------------------------------------------------------------------------

export type DiscoveredCalendar = {
  url: string;
  displayName: string;
  ctag: string | null;
  color?: string;
};

type ConnectParams = {
  serverUrl: string;
  username: string;
  password: string;
};

function makeClient(params: ConnectParams): DAVClient {
  return new DAVClient({
    serverUrl: params.serverUrl,
    credentials: { username: params.username, password: params.password },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });
}

export async function discoverCalendars(
  params: ConnectParams,
): Promise<DiscoveredCalendar[]> {
  const client = makeClient(params);
  try {
    await client.login();
  } catch {
    throw new AppError(
      "CalDAV authentication failed",
      "CALDAV_AUTH_FAILED",
      401,
    );
  }

  let calendars: DAVCalendar[];
  try {
    calendars = await client.fetchCalendars();
  } catch {
    throw new AppError(
      "CalDAV authentication failed",
      "CALDAV_AUTH_FAILED",
      401,
    );
  }

  return calendars
    .filter((c) => c.components?.includes("VEVENT"))
    .map((c) => ({
      url: c.url,
      displayName:
        typeof c.displayName === "string"
          ? c.displayName
          : (c.displayName as Record<string, unknown>)?._cdata?.toString() ??
            c.url,
      ctag: c.ctag ?? null,
      color: c.calendarColor ?? undefined,
    }));
}

// ---------------------------------------------------------------------------
// Authenticated client for a persisted member
// ---------------------------------------------------------------------------

async function getClientForMember(memberId: string): Promise<{
  client: DAVClient;
  calendar: DAVCalendar;
}> {
  const member = await db.member.findUnique({ where: { id: memberId } });
  if (!member) throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);
  if (!member.caldavPasswordEnc || !member.caldavServerUrl || !member.caldavCalendarUrl) {
    throw new AppError(
      "Member has not connected a CalDAV account",
      "CALDAV_NOT_CONNECTED",
      400,
    );
  }

  const password = decryptToken(member.caldavPasswordEnc);
  const client = makeClient({
    serverUrl: member.caldavServerUrl,
    username: member.caldavUsername ?? "",
    password,
  });

  await client.login();

  const calendar: DAVCalendar = { url: member.caldavCalendarUrl };
  return { client, calendar };
}

// ---------------------------------------------------------------------------
// Pull (incremental via ctag)
// ---------------------------------------------------------------------------

function parseCaldavDateTime(
  time: ICAL.Time,
): { date: Date; allDay: boolean } {
  return { date: time.toJSDate(), allDay: time.isDate };
}

// Normalise allDay DTEND: RFC 5545 makes it exclusive, our model stores inclusive.
function normalizeEnd(endsAt: Date, startsAt: Date, allDay: boolean): Date {
  return allDay && endsAt > startsAt
    ? new Date(endsAt.getTime() - 24 * 60 * 60 * 1000)
    : endsAt;
}

type OccurrenceRow = {
  caldavUid: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
};

// Expand a recurring VEVENT into occurrence rows within [rangeStart, rangeEnd].
// Exception VEVENTs (RECURRENCE-ID) in the same VCALENDAR are wired in so that
// getOccurrenceDetails resolves overrides and EXDATE skips automatically.
function expandRecurring(
  masterVevent: ICAL.Component,
  exceptionVevents: ICAL.Component[],
  masterUid: string,
  rangeStart: ICAL.Time,
  rangeEnd: ICAL.Time,
): OccurrenceRow[] {
  const masterEvent = new ICAL.Event(masterVevent);

  for (const ex of exceptionVevents) {
    masterEvent.relateException(ex);
  }

  // Fast-forward iteration to rangeStart so long-running series (e.g. a daily
  // standup recurring since 2010) don't burn through the safety counter before
  // reaching the sync window. ICAL's iterator only treats this as a reference
  // dtstart, so the first next() returns the next valid occurrence ≥ rangeStart.
  const iterStart = masterEvent.startDate.compare(rangeStart) < 0
    ? rangeStart
    : masterEvent.startDate;
  const iter = masterEvent.iterator(iterStart);
  const rows: OccurrenceRow[] = [];
  // Guard against pathological infinite RRULEs (e.g. FREQ=SECONDLY with no COUNT/UNTIL).
  const MAX_OCCURRENCES = 5000;
  let safety = 0;
  let next: ICAL.Time | null;

  while ((next = iter.next()) && safety < MAX_OCCURRENCES) {
    safety++;

    if (next.compare(rangeEnd) > 0) break;
    if (next.compare(rangeStart) < 0) continue;

    const details = masterEvent.getOccurrenceDetails(next);
    const item = details.item;

    const { date: startsAt, allDay } = parseCaldavDateTime(details.startDate);
    const { date: endsAt } = parseCaldavDateTime(details.endDate);

    // Use the occurrence's ICAL string representation as the suffix so UIDs
    // are stable across syncs regardless of timezone formatting differences.
    const occurrenceKey = details.recurrenceId.toString();
    const occurrenceUid = `${masterUid}_${occurrenceKey}`;

    rows.push({
      caldavUid: occurrenceUid,
      title: item.summary || "(no title)",
      description: item.description || null,
      location: item.location || null,
      startsAt,
      endsAt: normalizeEnd(endsAt, startsAt, allDay),
      allDay,
    });
  }

  return rows;
}

export async function pullCaldavForMember(memberId: string): Promise<SyncCounts> {
  const member = await db.member.findUnique({ where: { id: memberId } });
  if (
    !member ||
    !member.caldavSyncEnabled ||
    !member.caldavPasswordEnc ||
    !member.caldavCalendarUrl
  ) {
    return { pulled: 0, pushed: 0, deleted: 0, skipped: 0 };
  }

  const password = decryptToken(member.caldavPasswordEnc);
  const client = makeClient({
    serverUrl: member.caldavServerUrl ?? "",
    username: member.caldavUsername ?? "",
    password,
  });

  await client.login();

  // Re-fetch the calendar to get current ctag.
  const calendars = await client.fetchCalendars();
  const current = calendars.find((c) => c.url === member.caldavCalendarUrl);

  // If ctag unchanged the collection has not been modified.
  if (current?.ctag && current.ctag === member.caldavCtag) {
    return { pulled: 0, pushed: 0, deleted: 0, skipped: 0 };
  }

  const rangeStart = ICAL.Time.fromJSDate(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    true,
  );
  const rangeEnd = ICAL.Time.fromJSDate(
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    true,
  );

  const objects = await client.fetchCalendarObjects({
    calendar: { url: member.caldavCalendarUrl },
    timeRange: {
      start: rangeStart.toJSDate().toISOString(),
      end: rangeEnd.toJSDate().toISOString(),
    },
  });

  let pulled = 0;
  let skipped = 0;
  let deleted = 0;

  for (const obj of objects) {
    if (!obj.data || typeof obj.data !== "string") {
      skipped++;
      continue;
    }

    let jcal: unknown;
    try {
      jcal = ICAL.parse(obj.data);
    } catch {
      skipped++;
      continue;
    }

    const vcal = new ICAL.Component(jcal as ICAL.Component["jCal"]);
    const allVevents = vcal.getAllSubcomponents("vevent");

    if (allVevents.length === 0) {
      skipped++;
      continue;
    }

    // Partition: master has no RECURRENCE-ID; overrides do.
    const masterVevent = allVevents.find(
      (v) => !v.getFirstPropertyValue("recurrence-id"),
    );
    const exceptionVevents = allVevents.filter(
      (v) => !!v.getFirstPropertyValue("recurrence-id"),
    );

    if (!masterVevent) {
      // Detached exception with no master in this object — skip.
      skipped++;
      continue;
    }

    const masterEvent = new ICAL.Event(masterVevent);
    const uid = masterEvent.uid;
    if (!uid) {
      skipped++;
      continue;
    }

    if (masterEvent.isRecurring()) {
      // If we own this series locally (LOCAL master with rrule + matching
      // caldavUid), server-side expandEventsInRange already handles display.
      // Skip pull-side expansion to prevent double-writing occurrence rows.
      const localMaster = await db.event.findFirst({
        where: {
          memberId,
          caldavUid: uid,
          rrule: { not: null },
          source: "LOCAL",
        },
        select: { id: true },
      });
      if (localMaster) {
        skipped++;
        continue;
      }

      // Expand all occurrences within the sync window.
      const occurrences = expandRecurring(
        masterVevent,
        exceptionVevents,
        uid,
        rangeStart,
        rangeEnd,
      );

      const writtenUids = new Set<string>();

      for (const occ of occurrences) {
        await db.event.upsert({
          where: { memberId_caldavUid: { memberId, caldavUid: occ.caldavUid } },
          update: {
            title: occ.title,
            description: occ.description,
            location: occ.location,
            startsAt: occ.startsAt,
            endsAt: occ.endsAt,
            allDay: occ.allDay,
            source: "CALDAV",
            caldavEtag: obj.etag ?? null,
            caldavHref: obj.url,
            caldavSyncedAt: new Date(),
          },
          create: {
            familyId: member.familyId,
            memberId,
            title: occ.title,
            description: occ.description,
            location: occ.location,
            startsAt: occ.startsAt,
            endsAt: occ.endsAt,
            allDay: occ.allDay,
            source: "CALDAV",
            caldavUid: occ.caldavUid,
            caldavEtag: obj.etag ?? null,
            caldavHref: obj.url,
            caldavSyncedAt: new Date(),
          },
        });
        writtenUids.add(occ.caldavUid);
        pulled++;
      }

      // Remove stale occurrence rows: occurrences that were in DB but are no
      // longer produced by the current RRULE (UNTIL shrunk, EXDATE added, etc.)
      // Also handles the case where RRULE was removed — master writes single
      // row under `uid`, then this cleanup wipes all `${uid}_*` rows.
      const stale = await db.event.deleteMany({
        where: {
          memberId,
          caldavUid: {
            startsWith: `${uid}_`,
            notIn: [...writtenUids],
          },
        },
      });
      deleted += stale.count;
    } else {
      // Non-recurring: upsert single row under the master UID.
      const start = masterEvent.startDate;
      const end = masterEvent.endDate;
      if (!start || !end) {
        skipped++;
        continue;
      }

      const { date: startsAt, allDay } = parseCaldavDateTime(start);
      const { date: endsAt } = parseCaldavDateTime(end);

      await db.event.upsert({
        where: { memberId_caldavUid: { memberId, caldavUid: uid } },
        update: {
          title: masterEvent.summary || "(no title)",
          description: masterEvent.description || null,
          location: masterEvent.location || null,
          startsAt,
          endsAt: normalizeEnd(endsAt, startsAt, allDay),
          allDay,
          source: "CALDAV",
          caldavEtag: obj.etag ?? null,
          caldavHref: obj.url,
          caldavSyncedAt: new Date(),
        },
        create: {
          familyId: member.familyId,
          memberId,
          title: masterEvent.summary || "(no title)",
          description: masterEvent.description || null,
          location: masterEvent.location || null,
          startsAt,
          endsAt: normalizeEnd(endsAt, startsAt, allDay),
          allDay,
          source: "CALDAV",
          caldavUid: uid,
          caldavEtag: obj.etag ?? null,
          caldavHref: obj.url,
          caldavSyncedAt: new Date(),
        },
      });
      pulled++;

      // If this UID previously had occurrence rows (was once recurring),
      // wipe them now that the RRULE is gone.
      const stale = await db.event.deleteMany({
        where: {
          memberId,
          caldavUid: { startsWith: `${uid}_` },
        },
      });
      deleted += stale.count;
    }
  }

  await db.member.update({
    where: { id: memberId },
    data: {
      caldavCtag: current?.ctag ?? member.caldavCtag,
      caldavSyncedAt: new Date(),
    },
  });

  return { pulled, pushed: 0, deleted, skipped };
}

// ---------------------------------------------------------------------------
// Build iCal string from a local Event
// ---------------------------------------------------------------------------

function buildVEventString(event: {
  caldavUid: string | null;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  rrule: string | null;
}): { icalString: string; uid: string } {
  const uid = event.caldavUid ?? randomUUID();

  const vcal = new ICAL.Component(["vcalendar", [], []]);
  vcal.updatePropertyWithValue("prodid", "-//FamilyBoard//CalDAV Sync//EN");
  vcal.updatePropertyWithValue("version", "2.0");

  const vevent = new ICAL.Component(["vevent", [], []]);
  vevent.updatePropertyWithValue("uid", uid);
  vevent.updatePropertyWithValue(
    "dtstamp",
    ICAL.Time.fromJSDate(new Date(), true),
  );

  if (event.allDay) {
    // DATE-only value per RFC 5545 §3.3.4
    const startTime = ICAL.Time.fromJSDate(event.startsAt, true);
    startTime.isDate = true;
    // DTEND for all-day events is exclusive — add one day.
    const endTime = ICAL.Time.fromJSDate(
      new Date(event.endsAt.getTime() + 24 * 60 * 60 * 1000),
      true,
    );
    endTime.isDate = true;
    vevent.updatePropertyWithValue("dtstart", startTime);
    vevent.updatePropertyWithValue("dtend", endTime);
  } else {
    vevent.updatePropertyWithValue(
      "dtstart",
      ICAL.Time.fromJSDate(event.startsAt, true),
    );
    vevent.updatePropertyWithValue(
      "dtend",
      ICAL.Time.fromJSDate(event.endsAt, true),
    );
  }

  vevent.updatePropertyWithValue("summary", event.title);
  if (event.description) {
    vevent.updatePropertyWithValue("description", event.description);
  }
  if (event.location) {
    vevent.updatePropertyWithValue("location", event.location);
  }

  if (event.rrule) {
    const normalized = normalizeRruleForUntilDateOnly(event.rrule, event.allDay);
    const recur = ICAL.Recur.fromString(normalized);
    vevent.updatePropertyWithValue("rrule", recur);
  }

  vcal.addSubcomponent(vevent);
  return { icalString: vcal.toString(), uid };
}

// ---------------------------------------------------------------------------
// Push (outgoing)
// ---------------------------------------------------------------------------

export async function pushLocalEventToCaldav(
  eventId: string,
): Promise<SyncCounts> {
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event || event.source !== "LOCAL") {
    return { pulled: 0, pushed: 0, deleted: 0, skipped: 0 };
  }

  const member = await db.member.findUnique({ where: { id: event.memberId } });
  if (!member || !member.caldavSyncEnabled || !member.caldavPasswordEnc || !member.caldavCalendarUrl) {
    return { pulled: 0, pushed: 0, deleted: 0, skipped: 0 };
  }

  const { icalString, uid } = buildVEventString({
    caldavUid: event.caldavUid,
    title: event.title,
    description: event.description,
    location: event.location,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    allDay: event.allDay,
    rrule: event.rrule,
  });

  const password = decryptToken(member.caldavPasswordEnc);
  const client = makeClient({
    serverUrl: member.caldavServerUrl ?? "",
    username: member.caldavUsername ?? "",
    password,
  });
  await client.login();

  if (event.caldavHref && event.caldavEtag) {
    // Update existing remote event — honour ETag for conflict detection.
    const res = await client.updateCalendarObject({
      calendarObject: {
        url: event.caldavHref,
        data: icalString,
        etag: event.caldavEtag,
      },
    });
    const newEtag = res.headers.get("ETag") ?? event.caldavEtag;
    await db.event.update({
      where: { id: eventId },
      data: { caldavEtag: newEtag, caldavSyncedAt: new Date() },
    });
  } else {
    // Create new remote event.
    const filename = `${uid}.ics`;
    const res = await client.createCalendarObject({
      calendar: { url: member.caldavCalendarUrl },
      iCalString: icalString,
      filename,
    });
    const href =
      res.headers.get("Location") ??
      `${member.caldavCalendarUrl.replace(/\/$/, "")}/${filename}`;
    const etag = res.headers.get("ETag") ?? null;
    await db.event.update({
      where: { id: eventId },
      data: {
        caldavUid: uid,
        caldavHref: href,
        caldavEtag: etag,
        caldavSyncedAt: new Date(),
      },
    });
  }

  return { pulled: 0, pushed: 1, deleted: 0, skipped: 0 };
}

// ---------------------------------------------------------------------------
// Delete (outgoing)
// ---------------------------------------------------------------------------

export async function deleteRemoteCaldavEvent(eventId: string): Promise<void> {
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event || !event.caldavHref) return;

  const member = await db.member.findUnique({ where: { id: event.memberId } });
  if (!member || !member.caldavPasswordEnc) return;

  const password = decryptToken(member.caldavPasswordEnc);
  const client = makeClient({
    serverUrl: member.caldavServerUrl ?? "",
    username: member.caldavUsername ?? "",
    password,
  });

  try {
    await client.login();
    await client.deleteCalendarObject({
      calendarObject: {
        url: event.caldavHref,
        etag: event.caldavEtag ?? undefined,
        data: undefined,
      },
    });
  } catch (err) {
    // 404 / 410 — already gone on the server; ignore.
    const status =
      err instanceof Error && "status" in err
        ? (err as { status?: number }).status
        : undefined;
    if (status !== 404 && status !== 410) {
      console.error(
        "[caldav] remote delete failed",
        err instanceof Error ? err.message : err,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Batch sync across all members
// ---------------------------------------------------------------------------

function addCounts(
  a: SyncCounts,
  b: SyncCounts,
): SyncCounts {
  return {
    pulled: a.pulled + b.pulled,
    pushed: a.pushed + b.pushed,
    deleted: a.deleted + b.deleted,
    skipped: a.skipped + b.skipped,
  };
}

export async function runCaldavSyncForAllMembers(): Promise<SyncCounts> {
  const members = await db.member.findMany({
    where: { caldavSyncEnabled: true, caldavPasswordEnc: { not: null } },
  });

  let total: SyncCounts = { pulled: 0, pushed: 0, deleted: 0, skipped: 0 };

  for (const m of members) {
    try {
      total = addCounts(total, await pullCaldavForMember(m.id));
    } catch (err) {
      console.error(
        `[caldav] member ${m.id} pull failed`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return total;
}

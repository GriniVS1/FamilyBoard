import "server-only";

import { DAVClient } from "tsdav";
import type { DAVCalendar } from "tsdav";
import ICAL from "ical.js";
import { randomUUID } from "node:crypto";
import { AppError } from "./api";
import { db } from "./db";
import { decryptToken, encryptToken } from "./crypto";
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

  const objects = await client.fetchCalendarObjects({
    calendar: { url: member.caldavCalendarUrl },
    // Restrict to 30-day window for initial/large syncs.
    timeRange: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    },
  });

  let pulled = 0;
  let skipped = 0;

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
    const vevent = vcal.getFirstSubcomponent("vevent");
    if (!vevent) {
      skipped++;
      continue;
    }

    const icalEvent = new ICAL.Event(vevent);
    const uid = icalEvent.uid;
    if (!uid) {
      skipped++;
      continue;
    }

    const start = icalEvent.startDate;
    const end = icalEvent.endDate;
    if (!start || !end) {
      skipped++;
      continue;
    }

    const { date: startsAt, allDay } = parseCaldavDateTime(start);
    const { date: endsAt } = parseCaldavDateTime(end);

    // For all-day events DTEND is exclusive (RFC 5545) but our model stores
    // the same-day end. Subtract one day so a one-day event doesn't show as
    // spanning into the next day.
    const normalizedEndsAt =
      allDay && endsAt > startsAt
        ? new Date(endsAt.getTime() - 24 * 60 * 60 * 1000)
        : endsAt;

    await db.event.upsert({
      where: { memberId_caldavUid: { memberId, caldavUid: uid } },
      update: {
        title: icalEvent.summary || "(no title)",
        description: icalEvent.description || null,
        location: icalEvent.location || null,
        startsAt,
        endsAt: normalizedEndsAt,
        allDay,
        source: "CALDAV",
        caldavEtag: obj.etag ?? null,
        caldavHref: obj.url,
        caldavSyncedAt: new Date(),
      },
      create: {
        familyId: member.familyId,
        memberId,
        title: icalEvent.summary || "(no title)",
        description: icalEvent.description || null,
        location: icalEvent.location || null,
        startsAt,
        endsAt: normalizedEndsAt,
        allDay,
        source: "CALDAV",
        caldavUid: uid,
        caldavEtag: obj.etag ?? null,
        caldavHref: obj.url,
        caldavSyncedAt: new Date(),
      },
    });
    pulled++;
  }

  await db.member.update({
    where: { id: memberId },
    data: {
      caldavCtag: current?.ctag ?? member.caldavCtag,
      caldavSyncedAt: new Date(),
    },
  });

  return { pulled, pushed: 0, deleted: 0, skipped };
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

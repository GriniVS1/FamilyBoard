import "server-only";

import {
  ConfidentialClientApplication,
  type AuthorizationCodeRequest,
  type AuthorizationUrlRequest,
} from "@azure/msal-node";
import { Client as GraphClient } from "@microsoft/microsoft-graph-client";
import { AppError } from "./api";
import { db } from "./db";
import { decryptToken, encryptToken } from "./crypto";
import { env, microsoftConfigured } from "./env";
import type { SyncCounts } from "./sync";
import { rruleToGraphRecurrence } from "./microsoft-recurrence";

export const MICROSOFT_OAUTH_REDIRECT_PATH = "/api/auth/microsoft/callback";

export const MICROSOFT_OAUTH_SCOPES = [
  "Calendars.ReadWrite",
  "User.Read",
  "offline_access",
] as const;

const ZERO: SyncCounts = { pulled: 0, pushed: 0, deleted: 0, skipped: 0 };

function addCounts(a: SyncCounts, b: SyncCounts): SyncCounts {
  return {
    pulled: a.pulled + b.pulled,
    pushed: a.pushed + b.pushed,
    deleted: a.deleted + b.deleted,
    skipped: a.skipped + b.skipped,
  };
}

export function isMicrosoftConfigured(): boolean {
  return microsoftConfigured;
}

let _msalClient: ConfidentialClientApplication | null = null;

export function getMsalClient(): ConfidentialClientApplication {
  if (!microsoftConfigured || !env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET) {
    throw new AppError(
      "Microsoft OAuth is not configured on this server",
      "MICROSOFT_NOT_CONFIGURED",
      503,
    );
  }
  if (!_msalClient) {
    _msalClient = new ConfidentialClientApplication({
      auth: {
        clientId: env.MICROSOFT_CLIENT_ID,
        clientSecret: env.MICROSOFT_CLIENT_SECRET,
        authority: `https://login.microsoftonline.com/${env.MICROSOFT_TENANT}`,
      },
    });
  }
  return _msalClient;
}

export async function getAuthorizeUrlAsync(state: string): Promise<string> {
  const client = getMsalClient();
  const redirectUri = `${env.NEXTAUTH_URL}${MICROSOFT_OAUTH_REDIRECT_PATH}`;

  const request: AuthorizationUrlRequest = {
    scopes: [...MICROSOFT_OAUTH_SCOPES],
    redirectUri,
    state,
    prompt: "select_account",
  };

  return client.getAuthCodeUrl(request);
}

type ExchangedTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  email: string;
};

export async function exchangeCodeForTokens(code: string): Promise<ExchangedTokens> {
  const client = getMsalClient();
  const redirectUri = `${env.NEXTAUTH_URL}${MICROSOFT_OAUTH_REDIRECT_PATH}`;

  const request: AuthorizationCodeRequest = {
    scopes: [...MICROSOFT_OAUTH_SCOPES],
    redirectUri,
    code,
  };

  const result = await client.acquireTokenByCode(request);

  if (!result) {
    throw new AppError("MSAL returned null result", "MICROSOFT_TOKEN_EXCHANGE_FAILED", 502);
  }

  const refreshToken = extractRefreshToken(result);

  // Email from the ID token claims
  const email =
    (result.idTokenClaims as Record<string, string> | undefined)?.preferred_username ??
    (result.idTokenClaims as Record<string, string> | undefined)?.email ??
    "";

  return {
    accessToken: result.accessToken,
    refreshToken,
    expiresAt: result.expiresOn ?? new Date(Date.now() + 3600 * 1000),
    email,
  };
}

// MSAL's AuthenticationResult doesn't expose refreshToken in the public type,
// but the underlying cache entry carries it. We reach into the cache here.
function extractRefreshToken(result: { account?: { homeAccountId?: string } | null }): string {
  if (!result.account?.homeAccountId) {
    throw new AppError(
      "No account in MSAL result — offline_access scope required",
      "MICROSOFT_NO_REFRESH_TOKEN",
      502,
    );
  }
  // MSAL stores tokens in its in-memory cache. The token cache serialization
  // exposes the refresh token. We serialize and parse to extract it.
  const client = getMsalClient();
  const serialized = client.getTokenCache().serialize();
  const cache = JSON.parse(serialized) as {
    RefreshToken?: Record<string, { secret?: string; home_account_id?: string }>;
  };

  if (!cache.RefreshToken) {
    throw new AppError(
      "No refresh token found in MSAL cache",
      "MICROSOFT_NO_REFRESH_TOKEN",
      502,
    );
  }

  const homeId = result.account.homeAccountId.toLowerCase();
  for (const entry of Object.values(cache.RefreshToken)) {
    if (entry.home_account_id?.toLowerCase() === homeId && entry.secret) {
      return entry.secret;
    }
  }

  throw new AppError(
    "Refresh token not located in MSAL cache",
    "MICROSOFT_NO_REFRESH_TOKEN",
    502,
  );
}

type GraphClientHandle = {
  client: GraphClient;
  accessToken: string;
};

export async function getGraphClientForMember(memberId: string): Promise<GraphClientHandle> {
  const member = await db.member.findUnique({ where: { id: memberId } });
  if (!member) {
    throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);
  }
  if (!member.microsoftRefreshTokenEnc) {
    throw new AppError(
      "Member has not connected a Microsoft account",
      "MICROSOFT_NOT_CONNECTED",
      400,
    );
  }

  const refreshToken = decryptToken(member.microsoftRefreshTokenEnc);

  // Reuse cached access token if it still has 30 s headroom.
  if (
    member.microsoftAccessToken &&
    member.microsoftAccessExpiresAt &&
    member.microsoftAccessExpiresAt.getTime() > Date.now() + 30_000
  ) {
    const accessToken = member.microsoftAccessToken;
    return {
      client: buildGraphClient(accessToken),
      accessToken,
    };
  }

  // Use the refresh token directly via the token endpoint — MSAL's
  // acquireTokenByRefreshToken handles this and will rotate the refresh token
  // if the server issues a new one.
  const msalClient = getMsalClient();
  const result = await msalClient.acquireTokenByRefreshToken({
    scopes: [...MICROSOFT_OAUTH_SCOPES],
    refreshToken,
  });

  if (!result) {
    throw new AppError("Failed to refresh Microsoft access token", "MICROSOFT_REFRESH_FAILED", 502);
  }

  const newAccessToken = result.accessToken;
  const newExpiresAt = result.expiresOn ?? new Date(Date.now() + 3600 * 1000);

  // Persist the rotated access token (and refresh token if MSAL rotated it).
  const updateData: {
    microsoftAccessToken: string;
    microsoftAccessExpiresAt: Date;
    microsoftRefreshTokenEnc?: string;
  } = {
    microsoftAccessToken: newAccessToken,
    microsoftAccessExpiresAt: newExpiresAt,
  };

  try {
    const newRefreshToken = extractRefreshToken(result);
    if (newRefreshToken !== refreshToken) {
      updateData.microsoftRefreshTokenEnc = encryptToken(newRefreshToken);
    }
  } catch {
    // Refresh token unchanged — no rotation needed.
  }

  await db.member.update({ where: { id: memberId }, data: updateData });

  return {
    client: buildGraphClient(newAccessToken),
    accessToken: newAccessToken,
  };
}

function buildGraphClient(accessToken: string): GraphClient {
  return GraphClient.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

// Graph API response types (only the fields we use)
type GraphEvent = {
  id?: string;
  type?: "singleInstance" | "occurrence" | "exception" | "seriesMaster";
  seriesMasterId?: string;
  subject?: string;
  body?: { content?: string };
  location?: { displayName?: string };
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  isAllDay?: boolean;
  "@removed"?: { reason?: string };
  "@odata.etag"?: string;
};

type GraphDeltaResponse = {
  value: GraphEvent[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
};

function parseGraphDateTime(
  dt: { dateTime?: string } | undefined,
  isAllDay: boolean,
): Date | null {
  if (!dt?.dateTime) return null;
  if (isAllDay) {
    const parts = dt.dateTime.split("T")[0].split("-").map(Number);
    if (parts.length !== 3) return null;
    const [y, m, d] = parts;
    return new Date(Date.UTC(y, m - 1, d));
  }
  return new Date(dt.dateTime);
}

async function fetchDeltaPage(
  client: GraphClient,
  url: string,
): Promise<GraphDeltaResponse> {
  // Use a raw GET when following nextLink/deltaLink which are full URLs.
  return client.api(url).get() as Promise<GraphDeltaResponse>;
}

export async function pullForMicrosoftMember(memberId: string): Promise<SyncCounts> {
  const member = await db.member.findUnique({ where: { id: memberId } });
  if (!member || !member.microsoftSyncEnabled || !member.microsoftRefreshTokenEnc) {
    return ZERO;
  }

  const { client } = await getGraphClientForMember(memberId);

  const calendarId = member.microsoftCalendarId ?? "me/calendar";

  let pulled = 0;
  let deleted = 0;
  let skipped = 0;

  const runDelta = async (startUrl: string): Promise<string | null> => {
    let url: string | null = startUrl;
    let newDeltaLink: string | null = null;

    while (url) {
      const page: GraphDeltaResponse = await fetchDeltaPage(client, url);

      for (const ev of page.value) {
        if (!ev.id) {
          skipped++;
          continue;
        }

        // Deleted events carry the @removed annotation.
        if ("@removed" in ev) {
          const res = await db.event.deleteMany({
            where: { memberId, microsoftEventId: ev.id },
          });
          if (res.count > 0) deleted++;
          continue;
        }

        const allDay = ev.isAllDay ?? false;
        const startsAt = parseGraphDateTime(ev.start, allDay);
        const endsAt = parseGraphDateTime(ev.end, allDay);
        if (!startsAt || !endsAt) {
          skipped++;
          continue;
        }

        const etag = ev["@odata.etag"] ?? null;

        // Instances of a locally-owned recurring series must not overwrite
        // the master row. The master is identified by the seriesMasterId
        // that Graph attaches to every expanded occurrence.
        if (ev.seriesMasterId) {
          const localMaster = await db.event.findFirst({
            where: {
              memberId,
              microsoftEventId: ev.seriesMasterId,
              rrule: { not: null },
            },
            select: { id: true },
          });
          if (localMaster) {
            skipped++;
            continue;
          }
        }

        await db.event.upsert({
          where: {
            memberId_microsoftEventId: { memberId, microsoftEventId: ev.id },
          },
          update: {
            title: ev.subject ?? "(no title)",
            description: ev.body?.content ?? null,
            location: ev.location?.displayName ?? null,
            startsAt,
            endsAt,
            allDay,
            source: "MICROSOFT",
            microsoftCalendarId: calendarId,
            microsoftEtag: etag,
            microsoftSyncedAt: new Date(),
          },
          create: {
            familyId: member.familyId,
            memberId,
            title: ev.subject ?? "(no title)",
            description: ev.body?.content ?? null,
            location: ev.location?.displayName ?? null,
            startsAt,
            endsAt,
            allDay,
            source: "MICROSOFT",
            microsoftEventId: ev.id,
            microsoftCalendarId: calendarId,
            microsoftEtag: etag,
            microsoftSyncedAt: new Date(),
          },
        });
        pulled++;
      }

      newDeltaLink = page["@odata.deltaLink"] ?? newDeltaLink;
      url = page["@odata.nextLink"] ?? null;
    }

    return newDeltaLink;
  };

  const buildInitialUrl = () => {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const windowEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const base = calendarId === "me/calendar"
      ? "me/calendarView/delta"
      : `me/calendars/${calendarId}/calendarView/delta`;
    return `https://graph.microsoft.com/v1.0/${base}?startDateTime=${windowStart}&endDateTime=${windowEnd}`;
  };

  let newDeltaLink: string | null = null;

  if (member.microsoftDeltaLink) {
    try {
      newDeltaLink = await runDelta(member.microsoftDeltaLink);
    } catch (err) {
      if (isDeltaExpiredError(err)) {
        // Delta link expired — fall back to a fresh window sync.
        await db.member.update({
          where: { id: memberId },
          data: { microsoftDeltaLink: null },
        });
        newDeltaLink = await runDelta(buildInitialUrl());
      } else {
        throw err;
      }
    }
  } else {
    newDeltaLink = await runDelta(buildInitialUrl());
  }

  await db.member.update({
    where: { id: memberId },
    data: {
      microsoftDeltaLink: newDeltaLink,
      microsoftSyncedAt: new Date(),
    },
  });

  return { pulled, pushed: 0, deleted, skipped };
}

function isDeltaExpiredError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { statusCode?: number; code?: string; message?: string };
  if (e.statusCode === 410) return true;
  if (e.code === "SyncStateNotFound") return true;
  if (typeof e.message === "string" && e.message.includes("SyncStateNotFound")) return true;
  return false;
}

export async function pushLocalEventToMicrosoft(eventId: string): Promise<SyncCounts> {
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event || event.source !== "LOCAL") return ZERO;

  const member = await db.member.findUnique({ where: { id: event.memberId } });
  if (!member || !member.microsoftSyncEnabled || !member.microsoftRefreshTokenEnc) {
    return ZERO;
  }

  const { client } = await getGraphClientForMember(member.id);

  const body: Record<string, unknown> = {
    subject: event.title,
    body: event.description
      ? { contentType: "text", content: event.description }
      : undefined,
    location: event.location
      ? { displayName: event.location }
      : undefined,
    start: {
      dateTime: event.startsAt.toISOString(),
      timeZone: "UTC",
    },
    end: {
      dateTime: event.endsAt.toISOString(),
      timeZone: "UTC",
    },
    isAllDay: event.allDay,
  };

  if (event.rrule) {
    body.recurrence = rruleToGraphRecurrence(event.rrule, event.startsAt);
  } else if (event.microsoftEventId) {
    // rrule was removed — collapse the series back to a single occurrence.
    body.recurrence = null;
  }

  if (event.microsoftEventId) {
    const headers: Record<string, string> = {};
    if (event.microsoftEtag) {
      headers["If-Match"] = event.microsoftEtag;
    }
    await client
      .api(`me/events/${event.microsoftEventId}`)
      .headers(headers)
      .patch(body);
    return { pulled: 0, pushed: 1, deleted: 0, skipped: 0 };
  }

  type CreatedEvent = { id?: string; "@odata.etag"?: string };
  const created: CreatedEvent = await client.api("me/events").post(body) as CreatedEvent;

  if (created.id) {
    await db.event.update({
      where: { id: event.id },
      data: {
        microsoftEventId: created.id,
        microsoftCalendarId: member.microsoftCalendarId ?? "me/calendar",
        microsoftEtag: created["@odata.etag"] ?? null,
        microsoftSyncedAt: new Date(),
      },
    });
  }

  return { pulled: 0, pushed: 1, deleted: 0, skipped: 0 };
}

// Resolve a recurrenceId ISO string to the Graph instance event id by querying
// the series instances endpoint and matching originalStart by UTC value.
async function resolveGraphInstanceId(
  client: GraphClient,
  seriesMasterId: string,
  recurrenceId: string,
): Promise<string | null> {
  const occurrenceDate = new Date(recurrenceId);
  const startDateTime = new Date(occurrenceDate.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const endDateTime = new Date(occurrenceDate.getTime() + 24 * 60 * 60 * 1000).toISOString();

  type InstancesResponse = { value: GraphEvent[] };
  const res: InstancesResponse = await client
    .api(`me/events/${seriesMasterId}/instances`)
    .query({ startDateTime, endDateTime })
    .get() as InstancesResponse;

  for (const inst of res.value ?? []) {
    if (!inst.id || !inst.start?.dateTime) continue;
    // Normalize: Graph may return local-zone datetimes without Z; parse as-is
    // and compare by proximity (< 60 s) to handle sub-minute offset drift.
    const instStart = new Date(
      inst.start.dateTime.endsWith("Z")
        ? inst.start.dateTime
        : inst.start.dateTime + "Z",
    );
    if (Math.abs(instStart.getTime() - occurrenceDate.getTime()) < 60_000) {
      return inst.id;
    }
  }

  return null;
}

export async function pushOverrideToMicrosoft(
  masterId: string,
  recurrenceId: string,
): Promise<void> {
  if (!microsoftConfigured) return;

  const master = await db.event.findUnique({ where: { id: masterId } });
  if (!master || master.source !== "LOCAL" || !master.microsoftEventId) return;

  const member = await db.member.findUnique({ where: { id: master.memberId } });
  if (!member || !member.microsoftSyncEnabled || !member.microsoftRefreshTokenEnc) return;

  const override = await db.eventOverride.findUnique({
    where: { masterId_recurrenceId: { masterId, recurrenceId } },
  });
  if (!override) return;

  try {
    const { client } = await getGraphClientForMember(member.id);

    const instanceId = await resolveGraphInstanceId(
      client,
      master.microsoftEventId,
      recurrenceId,
    );
    if (!instanceId) {
      console.warn("[microsoft] pushOverrideToMicrosoft: could not resolve instance id");
      return;
    }

    if (override.cancelled) {
      await client.api(`me/events/${instanceId}`).delete();
      return;
    }

    const effectiveAllDay = override.allDay ?? master.allDay;
    const effectiveStartsAt = override.startsAt ?? master.startsAt;
    const effectiveEndsAt = override.endsAt ?? master.endsAt;

    const body: Record<string, unknown> = {};
    if (override.title !== null) body.subject = override.title;
    if (override.description !== null) {
      body.body = override.description
        ? { contentType: "text", content: override.description }
        : undefined;
    }
    if (override.location !== null) {
      body.location = override.location
        ? { displayName: override.location }
        : undefined;
    }
    if (override.startsAt !== null || override.allDay !== null) {
      body.start = { dateTime: effectiveStartsAt.toISOString(), timeZone: "UTC" };
    }
    if (override.endsAt !== null || override.allDay !== null) {
      body.end = { dateTime: effectiveEndsAt.toISOString(), timeZone: "UTC" };
    }
    if (override.allDay !== null) {
      body.isAllDay = effectiveAllDay;
    }

    if (Object.keys(body).length > 0) {
      await client.api(`me/events/${instanceId}`).patch(body);
    }
  } catch (err) {
    console.warn(
      "[microsoft] pushOverrideToMicrosoft failed",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function deleteRemoteMicrosoftEvent(eventId: string): Promise<void> {
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event || !event.microsoftEventId) return;

  const member = await db.member.findUnique({ where: { id: event.memberId } });
  if (!member || !member.microsoftRefreshTokenEnc) return;

  try {
    const { client } = await getGraphClientForMember(member.id);
    await client.api(`me/events/${event.microsoftEventId}`).delete();
  } catch (err) {
    if (!isNotFoundLike(err)) {
      console.error(
        "[microsoft] remote delete failed",
        err instanceof Error ? err.message : err,
      );
    }
  }
}

function isNotFoundLike(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { statusCode?: number };
  return e.statusCode === 404 || e.statusCode === 410;
}

export async function runMicrosoftSyncForAllMembers(): Promise<SyncCounts> {
  if (!microsoftConfigured) return ZERO;

  const members = await db.member.findMany({
    where: {
      microsoftSyncEnabled: true,
      microsoftRefreshTokenEnc: { not: null },
    },
  });

  let total: SyncCounts = ZERO;
  for (const m of members) {
    try {
      total = addCounts(total, await pullForMicrosoftMember(m.id));
    } catch (err) {
      console.error(
        `[microsoft] member ${m.id} sync failed`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return total;
}

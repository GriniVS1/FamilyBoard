import "server-only";

import { randomBytes } from "node:crypto";
import { AppError } from "./api";
import { db } from "./db";
import { buildAuthorizeUrl, getOAuth2Client } from "./google";
import { decryptToken, encryptToken } from "./crypto";
import { env, googleConfigured, brokerConfigured } from "./env";
import { getAuthorizeUrlAsync, isMicrosoftConfigured } from "./microsoft";
import {
  CALDAV_PRESETS,
  discoverCalendars,
  pullCaldavForMember,
  type CaldavPresetKey,
  type DiscoveredCalendar,
} from "./caldav";
import type { Member } from "@prisma/client";

// Shared business logic behind both the wall's admin-PIN-gated per-member
// routes (src/app/api/members/[id]/connect-*) and the mobile companion app's
// self-service routes (src/app/api/mobile/calendar/*). Callers own their own
// auth gate (requireAdminPin vs requireMobileAuth) — everything below assumes
// the caller has already established the request is authorized to act on
// `memberId`.

const STATE_TTL_MS = 10 * 60 * 1000;

export type ConnectSource = "mobile";

type Provider = "google" | "microsoft" | "caldav";

type ConflictFlags = Pick<
  Member,
  "googleSyncEnabled" | "microsoftSyncEnabled" | "caldavSyncEnabled"
>;

const CONFLICT_ORDER: Record<
  Provider,
  { flag: keyof ConflictFlags; label: string }[]
> = {
  google: [
    { flag: "caldavSyncEnabled", label: "CalDAV" },
    { flag: "microsoftSyncEnabled", label: "Microsoft" },
  ],
  microsoft: [
    { flag: "googleSyncEnabled", label: "Google" },
    { flag: "caldavSyncEnabled", label: "CalDAV" },
  ],
  caldav: [
    { flag: "googleSyncEnabled", label: "Google" },
    { flag: "microsoftSyncEnabled", label: "Microsoft" },
  ],
};

function assertNoProviderConflict(member: ConflictFlags, target: Provider): void {
  for (const check of CONFLICT_ORDER[target]) {
    if (member[check.flag]) {
      throw new AppError(
        `Member is already linked to ${check.label}. Disconnect ${check.label} first or use a different member.`,
        "PROVIDER_CONFLICT",
        400,
      );
    }
  }
}

async function findMemberOrThrow(memberId: string): Promise<Member> {
  const member = await db.member.findUnique({ where: { id: memberId } });
  if (!member) throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);
  return member;
}

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------

export async function startGoogleConnect(
  memberId: string,
  opts: { returnUrl?: string; source?: ConnectSource } = {},
): Promise<{ authorizeUrl: string }> {
  const member = await findMemberOrThrow(memberId);
  assertNoProviderConflict(member, "google");

  // Self-hosted with local client credentials → direct OAuth (unchanged).
  if (googleConfigured) {
    const state = randomBytes(32).toString("hex");
    const value = JSON.stringify({
      memberId,
      expiresAt: Date.now() + STATE_TTL_MS,
      source: opts.source,
    });
    await db.setting.upsert({
      where: { key: `oauth_state_${state}` },
      update: { value },
      create: { key: `oauth_state_${state}`, value },
    });
    return { authorizeUrl: buildAuthorizeUrl(state) };
  }

  // Shipped device → route through the OAuth broker. The device holds the
  // adoptSecret; the broker encrypts the refresh token with it and redirects
  // back to /api/auth/google/adopt on this device. See docs/google-oauth-broker-plan.md.
  // `opts.returnUrl` lets mobile-initiated flows point the broker back at the
  // LAN address the phone reached this device on, instead of NEXTAUTH_URL
  // (which the phone's browser may not be able to resolve/route to).
  const adoptSecret = randomBytes(32).toString("hex");
  const returnUrl = opts.returnUrl ?? `${env.NEXTAUTH_URL}/api/auth/google/adopt`;

  let res: Response;
  try {
    res = await fetch(`${env.OAUTH_BROKER_URL}/oauth/google/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memberId, adoptSecret, returnUrl }),
    });
  } catch {
    // fetch() itself throws on connection refused / DNS failure / timeout —
    // the actual "broker unreachable" case, distinct from a non-2xx response.
    throw new AppError("OAuth broker unreachable", "BROKER_UNREACHABLE", 502);
  }
  if (!res.ok) {
    throw new AppError("OAuth broker unreachable", "BROKER_UNREACHABLE", 502);
  }
  const { authorizeUrl, state } = (await res.json()) as {
    authorizeUrl: string;
    state: string;
  };

  const value = JSON.stringify({
    memberId,
    adoptSecret,
    expiresAt: Date.now() + STATE_TTL_MS,
    source: opts.source,
  });
  await db.setting.upsert({
    where: { key: `google_adopt_${state}` },
    update: { value },
    create: { key: `google_adopt_${state}`, value },
  });

  return { authorizeUrl };
}

export async function disconnectGoogle(memberId: string): Promise<void> {
  const member = await findMemberOrThrow(memberId);

  if (member.googleRefreshTokenEnc) {
    try {
      const refreshToken = decryptToken(member.googleRefreshTokenEnc);
      const client = getOAuth2Client();
      await client.revokeToken(refreshToken);
    } catch {
      // best-effort revoke
    }
  }

  await db.member.update({
    where: { id: memberId },
    data: {
      googleEmail: null,
      googleRefreshTokenEnc: null,
      googleAccessToken: null,
      googleAccessExpiresAt: null,
      googleSyncToken: null,
      googleSyncEnabled: false,
    },
  });
}

// ---------------------------------------------------------------------------
// Microsoft
// ---------------------------------------------------------------------------

export async function startMicrosoftConnect(
  memberId: string,
  opts: { returnUrl?: string; source?: ConnectSource } = {},
): Promise<{ authorizeUrl: string }> {
  const member = await findMemberOrThrow(memberId);
  assertNoProviderConflict(member, "microsoft");

  // Self-hosted with local Azure credentials → direct OAuth via MSAL (unchanged).
  if (isMicrosoftConfigured()) {
    const stateToken = randomBytes(32).toString("hex");
    const payload = JSON.stringify({
      memberId,
      expiresAt: Date.now() + STATE_TTL_MS,
      source: opts.source,
    });

    await db.setting.upsert({
      where: { key: `microsoft_oauth_state:${stateToken}` },
      update: { value: payload },
      create: { key: `microsoft_oauth_state:${stateToken}`, value: payload },
    });

    const authorizeUrl = await getAuthorizeUrlAsync(stateToken);
    return { authorizeUrl };
  }

  // Shipped device → route through the OAuth broker (mirror of the Google path).
  // The device holds the adoptSecret; the broker encrypts the refresh token with
  // it and redirects back to /api/auth/microsoft/adopt on this device.
  if (!brokerConfigured) {
    throw new AppError(
      "Microsoft OAuth is not configured on this server",
      "MICROSOFT_NOT_CONFIGURED",
      503,
    );
  }

  const adoptSecret = randomBytes(32).toString("hex");
  const returnUrl = opts.returnUrl ?? `${env.NEXTAUTH_URL}/api/auth/microsoft/adopt`;

  let res: Response;
  try {
    res = await fetch(`${env.OAUTH_BROKER_URL}/oauth/microsoft/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memberId, adoptSecret, returnUrl }),
    });
  } catch {
    throw new AppError("OAuth broker unreachable", "BROKER_UNREACHABLE", 502);
  }
  if (!res.ok) {
    throw new AppError("OAuth broker unreachable", "BROKER_UNREACHABLE", 502);
  }
  const { authorizeUrl, state } = (await res.json()) as {
    authorizeUrl: string;
    state: string;
  };

  const value = JSON.stringify({
    memberId,
    adoptSecret,
    expiresAt: Date.now() + STATE_TTL_MS,
    source: opts.source,
  });
  await db.setting.upsert({
    where: { key: `microsoft_adopt_${state}` },
    update: { value },
    create: { key: `microsoft_adopt_${state}`, value },
  });

  return { authorizeUrl };
}

export async function disconnectMicrosoft(memberId: string): Promise<void> {
  await findMemberOrThrow(memberId);

  // Remove all Microsoft-sourced events for this member before wiping credentials.
  await db.event.deleteMany({
    where: { memberId, microsoftEventId: { not: null } },
  });

  await db.member.update({
    where: { id: memberId },
    data: {
      microsoftEmail: null,
      microsoftRefreshTokenEnc: null,
      microsoftAccessToken: null,
      microsoftAccessExpiresAt: null,
      microsoftCalendarId: null,
      microsoftDeltaLink: null,
      microsoftSyncEnabled: false,
      microsoftSyncedAt: null,
    },
  });
}

// ---------------------------------------------------------------------------
// CalDAV
// ---------------------------------------------------------------------------

export type ConnectCaldavInput = {
  serverUrl?: string;
  username: string;
  password: string;
  preset?: CaldavPresetKey;
};

export async function connectCaldav(
  memberId: string,
  input: ConnectCaldavInput,
): Promise<{ calendars: DiscoveredCalendar[] }> {
  const member = await findMemberOrThrow(memberId);
  assertNoProviderConflict(member, "caldav");

  // For presets with a fixed serverUrl, the preset always wins (nextcloud /
  // custom have no fixed URL, so the caller-supplied one is used instead).
  const preset = input.preset ? CALDAV_PRESETS[input.preset] : undefined;
  const resolvedServerUrl = preset?.serverUrl ?? input.serverUrl;
  if (!resolvedServerUrl) {
    throw new AppError(
      "serverUrl is required for this preset",
      "SERVER_URL_REQUIRED",
      400,
    );
  }

  const calendars = await discoverCalendars({
    serverUrl: resolvedServerUrl,
    username: input.username,
    password: input.password,
  });

  // Persist credentials now; caldavSyncEnabled stays false until the user
  // picks a specific calendar via selectCaldavCalendar.
  await db.member.update({
    where: { id: memberId },
    data: {
      caldavServerUrl: resolvedServerUrl,
      caldavUsername: input.username,
      caldavPasswordEnc: encryptToken(input.password),
      caldavSyncEnabled: false,
    },
  });

  return { calendars };
}

export async function selectCaldavCalendar(
  memberId: string,
  input: { calendarUrl: string; calendarName: string },
): Promise<{ ok: true; synced: Awaited<ReturnType<typeof pullCaldavForMember>> }> {
  const member = await findMemberOrThrow(memberId);
  if (!member.caldavPasswordEnc) {
    throw new AppError(
      "CalDAV credentials not set — call connect-caldav first",
      "CALDAV_NOT_CONNECTED",
      400,
    );
  }

  await db.member.update({
    where: { id: memberId },
    data: {
      caldavCalendarUrl: input.calendarUrl,
      caldavCalendarName: input.calendarName,
      caldavCtag: null,
      caldavSyncEnabled: true,
    },
  });

  const synced = await pullCaldavForMember(memberId);
  return { ok: true, synced };
}

export async function disconnectCaldav(memberId: string): Promise<void> {
  await findMemberOrThrow(memberId);

  // Remove all events that originated from this member's CalDAV feed.
  await db.event.deleteMany({
    where: { memberId, caldavUid: { not: null } },
  });

  await db.member.update({
    where: { id: memberId },
    data: {
      caldavServerUrl: null,
      caldavUsername: null,
      caldavPasswordEnc: null,
      caldavCalendarUrl: null,
      caldavCalendarName: null,
      caldavCtag: null,
      caldavSyncEnabled: false,
      caldavSyncedAt: null,
    },
  });
}

// ---------------------------------------------------------------------------
// Status (mobile — unified across providers)
// ---------------------------------------------------------------------------

export type CalendarProviderStatus = {
  provider: "google" | "caldav" | "microsoft" | null;
  connected: boolean;
  accountLabel: string | null;
};

export function getCalendarProviderStatus(
  member: Pick<
    Member,
    | "googleSyncEnabled"
    | "googleEmail"
    | "microsoftSyncEnabled"
    | "microsoftEmail"
    | "caldavSyncEnabled"
    | "caldavUsername"
    | "caldavCalendarName"
  >,
): CalendarProviderStatus {
  if (member.googleSyncEnabled) {
    return { provider: "google", connected: true, accountLabel: member.googleEmail ?? null };
  }
  if (member.microsoftSyncEnabled) {
    return { provider: "microsoft", connected: true, accountLabel: member.microsoftEmail ?? null };
  }
  if (member.caldavSyncEnabled) {
    const label =
      member.caldavUsername && member.caldavCalendarName
        ? `${member.caldavUsername} · ${member.caldavCalendarName}`
        : member.caldavUsername ?? member.caldavCalendarName ?? null;
    return { provider: "caldav", connected: true, accountLabel: label };
  }
  return { provider: null, connected: false, accountLabel: null };
}

export async function disconnectCurrentProvider(
  member: Pick<Member, "id" | "googleSyncEnabled" | "microsoftSyncEnabled" | "caldavSyncEnabled">,
): Promise<void> {
  if (member.googleSyncEnabled) return disconnectGoogle(member.id);
  if (member.microsoftSyncEnabled) return disconnectMicrosoft(member.id);
  if (member.caldavSyncEnabled) return disconnectCaldav(member.id);
  throw new AppError("No calendar provider connected", "NOT_CONNECTED", 400);
}

import "server-only";

import { google, type calendar_v3 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { AppError } from "./api";
import { db } from "./db";
import { decryptToken, encryptToken } from "./crypto";
import { env, googleConfigured, brokerConfigured } from "./env";

export const GOOGLE_OAUTH_REDIRECT_PATH = "/api/auth/google/callback";

export const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "openid",
  "email",
] as const;

export type GoogleEvent = calendar_v3.Schema$Event;

export function getOAuth2Client(): OAuth2Client {
  if (!googleConfigured || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new AppError(
      "Google OAuth is not configured on this server",
      "GOOGLE_NOT_CONFIGURED",
      400,
    );
  }
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    `${env.NEXTAUTH_URL}${GOOGLE_OAUTH_REDIRECT_PATH}`,
  );
}

export function buildAuthorizeUrl(state: string): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [...GOOGLE_OAUTH_SCOPES],
    state,
    include_granted_scopes: true,
  });
}

type UserInfo = { email?: string };

export async function fetchUserInfo(accessToken: string): Promise<UserInfo> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new AppError(
      `Google userinfo failed (${res.status})`,
      "GOOGLE_USERINFO_FAILED",
      502,
    );
  }
  const json = (await res.json()) as { email?: string };
  return { email: json.email };
}

// Mint an access token from a refresh token via the OAuth broker. Shipped
// devices have no local client secret, so they can't do the refresh grant
// themselves — the broker (which holds the vendor secret) does it for them.
async function refreshAccessTokenViaBroker(
  refreshToken: string,
): Promise<{ accessToken: string; expiresAt: Date }> {
  const res = await fetch(`${env.OAUTH_BROKER_URL}/oauth/google/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    throw new AppError(
      `Broker token refresh failed (${res.status})`,
      res.status === 401 ? "GOOGLE_TOKEN_REVOKED" : "BROKER_REFRESH_FAILED",
      502,
    );
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new AppError("Broker returned no access token", "BROKER_REFRESH_FAILED", 502);
  }
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
  };
}

export async function getCalendarForMember(
  memberId: string,
): Promise<calendar_v3.Calendar> {
  const member = await db.member.findUnique({ where: { id: memberId } });
  if (!member) {
    throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);
  }
  if (!member.googleRefreshTokenEnc) {
    throw new AppError(
      "Member has not connected a Google account",
      "GOOGLE_NOT_CONNECTED",
      400,
    );
  }

  const refreshToken = decryptToken(member.googleRefreshTokenEnc);

  // Broker mode: no local client secret. Refresh the access token through the
  // broker and drive the Google client with a bare bearer token — no client
  // credentials on the device, so googleapis' own auto-refresh never runs. We
  // pre-refresh whenever the cached token is missing or expires within 60 s.
  if (!googleConfigured && brokerConfigured) {
    const cached = member.googleAccessToken;
    const expiresAt = member.googleAccessExpiresAt;
    let accessToken = cached ?? undefined;
    if (!accessToken || !expiresAt || expiresAt.getTime() < Date.now() + 60_000) {
      const refreshed = await refreshAccessTokenViaBroker(refreshToken);
      accessToken = refreshed.accessToken;
      await db.member.update({
        where: { id: memberId },
        data: {
          googleAccessToken: refreshed.accessToken,
          googleAccessExpiresAt: refreshed.expiresAt,
        },
      });
    }
    const brokerClient = new google.auth.OAuth2();
    brokerClient.setCredentials({ access_token: accessToken });
    return google.calendar({ version: "v3", auth: brokerClient });
  }

  const client = getOAuth2Client();

  const credentials: {
    refresh_token: string;
    access_token?: string;
    expiry_date?: number;
  } = { refresh_token: refreshToken };

  const expiresAt = member.googleAccessExpiresAt;
  if (
    member.googleAccessToken &&
    expiresAt &&
    expiresAt.getTime() > Date.now() + 30_000
  ) {
    credentials.access_token = member.googleAccessToken;
    credentials.expiry_date = expiresAt.getTime();
  }

  client.setCredentials(credentials);

  // Persist rotated tokens so we don't burn the refresh count.
  client.on("tokens", (tokens) => {
    void (async () => {
      try {
        const data: {
          googleAccessToken?: string | null;
          googleAccessExpiresAt?: Date | null;
          googleRefreshTokenEnc?: string;
        } = {};
        if (tokens.access_token) {
          data.googleAccessToken = tokens.access_token;
        }
        if (tokens.expiry_date) {
          data.googleAccessExpiresAt = new Date(tokens.expiry_date);
        }
        if (tokens.refresh_token) {
          data.googleRefreshTokenEnc = encryptToken(tokens.refresh_token);
        }
        if (Object.keys(data).length > 0) {
          await db.member.update({ where: { id: memberId }, data });
        }
      } catch (err) {
        console.error(
          "[google] failed to persist refreshed tokens",
          err instanceof Error ? err.message : err,
        );
      }
    })();
  });

  return google.calendar({ version: "v3", auth: client });
}

export type IncrementalEventsResult = {
  events: GoogleEvent[];
  nextSyncToken: string | null;
  fullSync: boolean;
};

type GoogleApiError = {
  code?: number;
  status?: number;
  response?: { status?: number };
};

function isGoneError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as GoogleApiError;
  return e.code === 410 || e.status === 410 || e.response?.status === 410;
}

export async function listIncrementalEvents(
  memberId: string,
): Promise<IncrementalEventsResult> {
  const calendar = await getCalendarForMember(memberId);
  const member = await db.member.findUnique({ where: { id: memberId } });
  if (!member) {
    throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);
  }

  const run = async (
    syncToken: string | null,
  ): Promise<IncrementalEventsResult> => {
    const events: GoogleEvent[] = [];
    let pageToken: string | undefined = undefined;
    let nextSyncToken: string | null = null;
    const fullSync = !syncToken;

    do {
      const params: calendar_v3.Params$Resource$Events$List = {
        calendarId: "primary",
        maxResults: 250,
        singleEvents: true,
        showDeleted: true,
        pageToken,
      };
      if (syncToken) {
        params.syncToken = syncToken;
      } else {
        const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        params.timeMin = timeMin.toISOString();
      }

      const res = await calendar.events.list(params);
      const items = res.data.items ?? [];
      for (const item of items) events.push(item);
      pageToken = res.data.nextPageToken ?? undefined;
      nextSyncToken = res.data.nextSyncToken ?? nextSyncToken;
    } while (pageToken);

    return { events, nextSyncToken, fullSync };
  };

  try {
    return await run(member.googleSyncToken ?? null);
  } catch (err) {
    if (isGoneError(err) && member.googleSyncToken) {
      // Sync token expired — drop it and retry with a full sync.
      await db.member.update({
        where: { id: memberId },
        data: { googleSyncToken: null },
      });
      return await run(null);
    }
    throw err;
  }
}

export function isNotFoundLike(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as GoogleApiError;
  const status = e.code ?? e.status ?? e.response?.status;
  return status === 404 || status === 410;
}

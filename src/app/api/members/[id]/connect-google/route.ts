import { randomBytes } from "node:crypto";
import { withErrorHandling, ok, AppError } from "@/lib/api";
import { db } from "@/lib/db";
import { buildAuthorizeUrl, getOAuth2Client } from "@/lib/google";
import { decryptToken } from "@/lib/crypto";
import { env, googleConfigured } from "@/lib/env";
import { requireAdminPin } from "@/lib/admin-pin";

export const runtime = "nodejs";

const STATE_TTL_MS = 10 * 60 * 1000;

type Ctx = { params: Promise<{ id: string }> };

export const POST = withErrorHandling<Ctx>(async (_req, { params }) => {
  await requireAdminPin(_req);
  const { id } = await params;
  const member = await db.member.findUnique({ where: { id } });
  if (!member) throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);

  if (member.caldavSyncEnabled) {
    throw new AppError(
      "Member is already linked to CalDAV. Disconnect CalDAV first or use a different member.",
      "PROVIDER_CONFLICT",
      400,
    );
  }

  if (member.microsoftSyncEnabled) {
    throw new AppError(
      "Member is already linked to Microsoft. Disconnect Microsoft first or use a different member.",
      "PROVIDER_CONFLICT",
      400,
    );
  }

  // Self-hosted with local client credentials → direct OAuth (unchanged).
  if (googleConfigured) {
    const state = randomBytes(32).toString("hex");
    await db.setting.upsert({
      where: { key: `oauth_state_${state}` },
      update: { value: JSON.stringify({ memberId: id, expiresAt: Date.now() + STATE_TTL_MS }) },
      create: {
        key: `oauth_state_${state}`,
        value: JSON.stringify({ memberId: id, expiresAt: Date.now() + STATE_TTL_MS }),
      },
    });
    return ok({ authorizeUrl: buildAuthorizeUrl(state) });
  }

  // Shipped device → route through the OAuth broker. The device holds the
  // adoptSecret; the broker encrypts the refresh token with it and redirects
  // back to /api/auth/google/adopt on this device. See docs/google-oauth-broker-plan.md.
  const adoptSecret = randomBytes(32).toString("hex");
  const returnUrl = `${env.NEXTAUTH_URL}/api/auth/google/adopt`;

  const res = await fetch(`${env.OAUTH_BROKER_URL}/oauth/google/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ memberId: id, adoptSecret, returnUrl }),
  });
  if (!res.ok) {
    throw new AppError("Update broker unreachable", "BROKER_UNREACHABLE", 502);
  }
  const { authorizeUrl, state } = (await res.json()) as {
    authorizeUrl: string;
    state: string;
  };

  await db.setting.upsert({
    where: { key: `google_adopt_${state}` },
    update: { value: JSON.stringify({ memberId: id, adoptSecret, expiresAt: Date.now() + STATE_TTL_MS }) },
    create: {
      key: `google_adopt_${state}`,
      value: JSON.stringify({ memberId: id, adoptSecret, expiresAt: Date.now() + STATE_TTL_MS }),
    },
  });

  return ok({ authorizeUrl });
});

export const DELETE = withErrorHandling<Ctx>(async (_req, { params }) => {
  await requireAdminPin(_req);
  const { id } = await params;
  const member = await db.member.findUnique({ where: { id } });
  if (!member) throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);

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
    where: { id },
    data: {
      googleEmail: null,
      googleRefreshTokenEnc: null,
      googleAccessToken: null,
      googleAccessExpiresAt: null,
      googleSyncToken: null,
      googleSyncEnabled: false,
    },
  });

  return ok({ ok: true });
});

import { randomBytes } from "node:crypto";
import { withErrorHandling, ok, AppError } from "@/lib/api";
import { db } from "@/lib/db";
import { buildAuthorizeUrl, getOAuth2Client } from "@/lib/google";
import { decryptToken } from "@/lib/crypto";

export const runtime = "nodejs";

const STATE_TTL_MS = 10 * 60 * 1000;

type Ctx = { params: Promise<{ id: string }> };

export const POST = withErrorHandling<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const member = await db.member.findUnique({ where: { id } });
  if (!member) throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);

  const state = randomBytes(32).toString("hex");
  const payload = JSON.stringify({
    memberId: id,
    expiresAt: Date.now() + STATE_TTL_MS,
  });
  await db.setting.upsert({
    where: { key: `oauth_state_${state}` },
    update: { value: payload },
    create: { key: `oauth_state_${state}`, value: payload },
  });

  const authorizeUrl = buildAuthorizeUrl(state);
  return ok({ authorizeUrl });
});

export const DELETE = withErrorHandling<Ctx>(async (_req, { params }) => {
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

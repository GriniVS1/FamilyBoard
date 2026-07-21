import { createDecipheriv } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encryptToken } from "@/lib/crypto";
import { env } from "@/lib/env";
import { getRequestOrigin } from "@/lib/network";
import { pullForMicrosoftMember } from "@/lib/microsoft";

export const runtime = "nodejs";

// Landing endpoint for the OAuth broker's Microsoft redirect. The broker
// encrypted the refresh token with the adoptSecret this device generated in
// startMicrosoftConnect; we look that secret up by state, decrypt, and store
// the token. Mirror of /api/auth/google/adopt.

function redirect(
  req: Request,
  reason: string,
  memberId?: string,
  ok = false,
  source?: "mobile",
) {
  if (source === "mobile") {
    const url = new URL("/calendar-connected", getRequestOrigin(req));
    url.searchParams.set("provider", "microsoft");
    url.searchParams.set("status", ok ? "connected" : "error");
    if (memberId) url.searchParams.set("member", memberId);
    if (!ok) url.searchParams.set("reason", reason);
    return NextResponse.redirect(url);
  }
  const url = new URL("/settings", env.NEXTAUTH_URL);
  url.searchParams.set("microsoft", ok ? "connected" : "error");
  if (memberId) url.searchParams.set("member", memberId);
  if (!ok) url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

// Mirror of the broker's Web Crypto AES-256-GCM output:
// base64url(iv(12) || ciphertext || tag(16)). adoptSecret is the raw 32-byte key (hex).
function decryptFromBroker(adoptSecretHex: string, payloadB64url: string): string {
  const buf = Buffer.from(payloadB64url.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(buf.length - 16);
  const enc = buf.subarray(12, buf.length - 16);
  const dec = createDecipheriv("aes-256-gcm", Buffer.from(adoptSecretHex, "hex"), iv);
  dec.setAuthTag(tag);
  return Buffer.concat([dec.update(enc), dec.final()]).toString("utf8");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = url.searchParams.get("state");
  const payload = url.searchParams.get("payload");
  if (!state || !payload) return redirect(req, "missing_params");

  // Consume the pending record atomically so a replayed redirect is rejected.
  let row: { value: string };
  try {
    row = await db.setting.delete({ where: { key: `microsoft_adopt_${state}` } });
  } catch {
    return redirect(req, "invalid_state");
  }

  let data: { memberId: string; adoptSecret: string; expiresAt: number; source?: "mobile" };
  try {
    data = JSON.parse(row.value);
  } catch {
    return redirect(req, "invalid_state");
  }
  const { source } = data;

  if (Date.now() > data.expiresAt) return redirect(req, "expired_state", data.memberId, false, source);

  const member = await db.member.findUnique({ where: { id: data.memberId } });
  if (!member) return redirect(req, "member_missing", data.memberId, false, source);

  let decoded: { refreshToken: string; email: string | null };
  try {
    decoded = JSON.parse(decryptFromBroker(data.adoptSecret, payload));
  } catch {
    return redirect(req, "decrypt_failed", data.memberId, false, source);
  }
  if (!decoded.refreshToken) return redirect(req, "no_refresh_token", data.memberId, false, source);

  await db.member.update({
    where: { id: data.memberId },
    data: {
      microsoftEmail: decoded.email ?? null,
      microsoftRefreshTokenEnc: encryptToken(decoded.refreshToken),
      microsoftAccessToken: null,
      microsoftAccessExpiresAt: null,
      microsoftDeltaLink: null,
      microsoftSyncEnabled: true,
    },
  });

  pullForMicrosoftMember(data.memberId).catch((err) => {
    console.error("[microsoft/adopt] initial sync failed", err instanceof Error ? err.message : err);
  });

  return redirect(req, "ok", data.memberId, true, source);
}

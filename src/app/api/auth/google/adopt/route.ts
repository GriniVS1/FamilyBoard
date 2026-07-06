import { createDecipheriv } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encryptToken } from "@/lib/crypto";
import { env } from "@/lib/env";
import { pullForMember } from "@/lib/sync";

export const runtime = "nodejs";

// Landing endpoint for the OAuth broker's redirect. The broker encrypted the
// refresh token with the adoptSecret this device generated in connect-google;
// we look that secret up by state, decrypt, and store the token as usual.
// See docs/google-oauth-broker-plan.md.

function redirect(reason: string, memberId?: string, ok = false) {
  const url = new URL("/settings", env.NEXTAUTH_URL);
  url.searchParams.set("google", ok ? "connected" : "error");
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
  if (!state || !payload) return redirect("missing_params");

  // Consume the pending record atomically so a replayed redirect is rejected.
  let row: { value: string };
  try {
    row = await db.setting.delete({ where: { key: `google_adopt_${state}` } });
  } catch {
    return redirect("invalid_state");
  }

  let data: { memberId: string; adoptSecret: string; expiresAt: number };
  try {
    data = JSON.parse(row.value);
  } catch {
    return redirect("invalid_state");
  }
  if (Date.now() > data.expiresAt) return redirect("expired_state", data.memberId);

  const member = await db.member.findUnique({ where: { id: data.memberId } });
  if (!member) return redirect("member_missing", data.memberId);

  let decoded: { refreshToken: string; email: string | null };
  try {
    decoded = JSON.parse(decryptFromBroker(data.adoptSecret, payload));
  } catch {
    return redirect("decrypt_failed", data.memberId);
  }
  if (!decoded.refreshToken) return redirect("no_refresh_token", data.memberId);

  await db.member.update({
    where: { id: data.memberId },
    data: {
      googleEmail: decoded.email ?? null,
      googleRefreshTokenEnc: encryptToken(decoded.refreshToken),
      googleAccessToken: null,
      googleAccessExpiresAt: null,
      googleSyncToken: null,
      googleSyncEnabled: true,
    },
  });

  pullForMember(data.memberId).catch((err) => {
    console.error("[google/adopt] initial sync failed", err instanceof Error ? err.message : err);
  });

  return redirect("ok", data.memberId, true);
}

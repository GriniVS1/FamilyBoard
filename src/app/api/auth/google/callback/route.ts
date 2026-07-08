import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encryptToken } from "@/lib/crypto";
import { env } from "@/lib/env";
import { fetchUserInfo, getOAuth2Client } from "@/lib/google";
import { pullForMember } from "@/lib/sync";

export const runtime = "nodejs";

function redirect(reason: string, memberId?: string, ok = false, source?: "mobile") {
  if (source === "mobile") {
    const url = new URL("/calendar-connected", env.NEXTAUTH_URL);
    url.searchParams.set("provider", "google");
    url.searchParams.set("status", ok ? "connected" : "error");
    if (memberId) url.searchParams.set("member", memberId);
    if (!ok) url.searchParams.set("reason", reason);
    return NextResponse.redirect(url);
  }
  const url = new URL("/settings", env.NEXTAUTH_URL);
  url.searchParams.set("google", ok ? "connected" : "error");
  if (memberId) url.searchParams.set("member", memberId);
  if (!ok) url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) return redirect(oauthError);
  if (!code || !state) return redirect("missing_params");

  // Consume the state atomically: delete-and-return in one query so a replayed
  // callback (same state) hits a missing row and is rejected. A findUnique +
  // later delete leaves a race window where two concurrent callbacks both pass.
  let stateRow: { value: string };
  try {
    stateRow = await db.setting.delete({
      where: { key: `oauth_state_${state}` },
    });
  } catch {
    return redirect("invalid_state");
  }

  let stateData: { memberId: string; expiresAt: number; source?: "mobile" };
  try {
    stateData = JSON.parse(stateRow.value);
  } catch {
    return redirect("invalid_state");
  }
  const { source } = stateData;

  if (Date.now() > stateData.expiresAt) return redirect("expired_state", stateData.memberId, false, source);

  const member = await db.member.findUnique({ where: { id: stateData.memberId } });
  if (!member) return redirect("member_missing", stateData.memberId, false, source);

  let tokens: {
    access_token?: string | null;
    refresh_token?: string | null;
    expiry_date?: number | null;
  };
  try {
    const client = getOAuth2Client();
    const res = await client.getToken(code);
    tokens = res.tokens;
  } catch {
    return redirect("token_exchange_failed", stateData.memberId, false, source);
  }

  if (!tokens.refresh_token) {
    return redirect("no_refresh_token", stateData.memberId, false, source);
  }

  let email: string | undefined;
  if (tokens.access_token) {
    try {
      const info = await fetchUserInfo(tokens.access_token);
      email = info.email;
    } catch {
      // non-fatal
    }
  }

  await db.member.update({
    where: { id: stateData.memberId },
    data: {
      googleEmail: email ?? null,
      googleRefreshTokenEnc: encryptToken(tokens.refresh_token),
      googleAccessToken: tokens.access_token ?? null,
      googleAccessExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      googleSyncToken: null,
      googleSyncEnabled: true,
    },
  });

  pullForMember(stateData.memberId).catch((err) => {
    console.error(
      "[oauth] initial sync failed",
      err instanceof Error ? err.message : err,
    );
  });

  return redirect("ok", stateData.memberId, true, source);
}

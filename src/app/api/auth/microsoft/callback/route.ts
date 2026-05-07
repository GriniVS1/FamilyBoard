import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encryptToken } from "@/lib/crypto";
import { env } from "@/lib/env";
import { exchangeCodeForTokens, pullForMicrosoftMember } from "@/lib/microsoft";

export const runtime = "nodejs";

function redirect(status: "connected" | "error", memberId?: string, reason?: string) {
  const url = new URL("/settings", env.NEXTAUTH_URL);
  url.searchParams.set("microsoft", status);
  if (memberId) url.searchParams.set("member", memberId);
  if (status === "error" && reason) url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) return redirect("error", undefined, oauthError);
  if (!code || !state) return redirect("error", undefined, "missing_params");

  const stateRow = await db.setting.findUnique({
    where: { key: `microsoft_oauth_state:${state}` },
  });
  if (!stateRow) return redirect("error", undefined, "invalid_state");

  let stateData: { memberId: string; expiresAt: number };
  try {
    stateData = JSON.parse(stateRow.value) as { memberId: string; expiresAt: number };
  } catch {
    return redirect("error", undefined, "invalid_state");
  }

  await db.setting.delete({ where: { key: `microsoft_oauth_state:${state}` } }).catch(() => {});

  if (Date.now() > stateData.expiresAt) {
    return redirect("error", stateData.memberId, "expired_state");
  }

  const member = await db.member.findUnique({ where: { id: stateData.memberId } });
  if (!member) return redirect("error", stateData.memberId, "member_missing");

  let tokens: Awaited<ReturnType<typeof exchangeCodeForTokens>>;
  try {
    tokens = await exchangeCodeForTokens(code);
  } catch {
    return redirect("error", stateData.memberId, "token_exchange_failed");
  }

  await db.member.update({
    where: { id: stateData.memberId },
    data: {
      microsoftEmail: tokens.email || null,
      microsoftRefreshTokenEnc: encryptToken(tokens.refreshToken),
      microsoftAccessToken: tokens.accessToken,
      microsoftAccessExpiresAt: tokens.expiresAt,
      microsoftDeltaLink: null,
      microsoftSyncEnabled: true,
    },
  });

  pullForMicrosoftMember(stateData.memberId).catch((err) => {
    console.error(
      "[microsoft/oauth] initial sync failed",
      err instanceof Error ? err.message : err,
    );
  });

  return redirect("connected", stateData.memberId);
}

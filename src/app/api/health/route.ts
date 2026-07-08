import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Health gates two things: the kiosk browser's first page load (.xinitrc polls
// this before launching Chromium) and the OTA updater's post-update check. It
// must therefore prove the app can actually SERVE a page — which requires a
// working database, not just a listening socket. Without the DB probe, the
// kiosk could load the very first page while Prisma was still cold; the root
// layout's locale read then failed silently and the wall stuck to English
// until the next full reload (field bug: "language lost after reboot/update").
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    return NextResponse.json(
      { ok: false, reason: "db_unavailable" },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: true, ts: new Date().toISOString() });
}

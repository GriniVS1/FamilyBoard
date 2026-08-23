import { withErrorHandling, ok, AppError } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandling<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const member = await db.member.findUnique({ where: { id } });
  if (!member) throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);

  const lastSyncRow = await db.setting.findUnique({
    where: { key: `last_sync_${id}` },
  });

  return ok({
    connected: Boolean(member.googleRefreshTokenEnc),
    email: member.googleEmail ?? undefined,
    syncEnabled: member.googleSyncEnabled,
    // Provider rejected the stored credential — the UI asks for a re-link and
    // the sync loop skips this member until then.
    authExpired: member.googleAuthFailedAt !== null,
    lastSyncAt: lastSyncRow?.value,
  });
});

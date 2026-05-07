import { withErrorHandling, ok, AppError } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandling<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const member = await db.member.findUnique({ where: { id } });
  if (!member) throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);

  return ok({
    connected: Boolean(member.caldavPasswordEnc),
    serverUrl: member.caldavServerUrl ?? undefined,
    username: member.caldavUsername ?? undefined,
    calendarName: member.caldavCalendarName ?? undefined,
    lastSyncedAt: member.caldavSyncedAt?.toISOString() ?? undefined,
  });
});

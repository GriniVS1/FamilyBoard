import { withErrorHandling, ok, AppError } from "@/lib/api";
import { db } from "@/lib/db";
import { requireAdminPin } from "@/lib/admin-pin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withErrorHandling<Ctx>(async (_req, { params }) => {
  await requireAdminPin(_req);
  const { id } = await params;
  const member = await db.member.findUnique({ where: { id } });
  if (!member) throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);

  // Remove all events that originated from this member's CalDAV feed.
  await db.event.deleteMany({
    where: { memberId: id, caldavUid: { not: null } },
  });

  await db.member.update({
    where: { id },
    data: {
      caldavServerUrl: null,
      caldavUsername: null,
      caldavPasswordEnc: null,
      caldavCalendarUrl: null,
      caldavCalendarName: null,
      caldavCtag: null,
      caldavSyncEnabled: false,
      caldavSyncedAt: null,
    },
  });

  return ok({ ok: true });
});

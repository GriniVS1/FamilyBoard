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

  // Remove all Microsoft-sourced events for this member before wiping credentials.
  await db.event.deleteMany({
    where: { memberId: id, microsoftEventId: { not: null } },
  });

  await db.member.update({
    where: { id },
    data: {
      microsoftEmail: null,
      microsoftRefreshTokenEnc: null,
      microsoftAccessToken: null,
      microsoftAccessExpiresAt: null,
      microsoftCalendarId: null,
      microsoftDeltaLink: null,
      microsoftSyncEnabled: false,
      microsoftSyncedAt: null,
    },
  });

  return ok({ ok: true });
});

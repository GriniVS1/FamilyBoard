import { z } from "zod";
import { withErrorHandling, ok, AppError } from "@/lib/api";
import { db } from "@/lib/db";
import { pullCaldavForMember } from "@/lib/caldav";
import { requireAdminPin } from "@/lib/admin-pin";

export const runtime = "nodejs";

const bodySchema = z.object({
  calendarUrl: z.string().url(),
  calendarName: z.string().min(1),
});

type Ctx = { params: Promise<{ id: string }> };

export const POST = withErrorHandling<Ctx>(async (req, { params }) => {
  await requireAdminPin(req);
  const { id } = await params;
  const member = await db.member.findUnique({ where: { id } });
  if (!member) throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);
  if (!member.caldavPasswordEnc) {
    throw new AppError(
      "CalDAV credentials not set — call /connect-caldav first",
      "CALDAV_NOT_CONNECTED",
      400,
    );
  }

  const body = bodySchema.parse(await req.json());

  await db.member.update({
    where: { id },
    data: {
      caldavCalendarUrl: body.calendarUrl,
      caldavCalendarName: body.calendarName,
      caldavCtag: null,
      caldavSyncEnabled: true,
    },
  });

  const synced = await pullCaldavForMember(id);
  return ok({ ok: true, synced });
});

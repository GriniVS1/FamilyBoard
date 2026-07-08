import { withErrorHandling, ok, AppError } from "@/lib/api";
import { db } from "@/lib/db";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { disconnectCurrentProvider } from "@/lib/calendar-connect";

export const runtime = "nodejs";

export const POST = withErrorHandling(async (req) => {
  const { memberId } = await requireMobileAuth(req);
  const member = await db.member.findUnique({ where: { id: memberId } });
  if (!member) throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);

  await disconnectCurrentProvider(member);
  return ok({ ok: true });
});

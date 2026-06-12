import { withErrorHandling, ok, AppError } from "@/lib/api";
import { db } from "@/lib/db";
import { pullForMember } from "@/lib/sync";
import { requireAdminPin } from "@/lib/admin-pin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withErrorHandling<Ctx>(async (_req, { params }) => {
  await requireAdminPin(_req);
  const { id } = await params;
  const member = await db.member.findUnique({ where: { id } });
  if (!member) throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);
  if (!member.googleRefreshTokenEnc) {
    throw new AppError("Member has not connected Google", "GOOGLE_NOT_CONNECTED", 400);
  }
  const counts = await pullForMember(id);
  return ok(counts);
});

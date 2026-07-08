import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { requireMobileAuth } from "@/lib/mobile-auth";
import {
  createMember,
  createMemberSchema,
  serializeMember,
} from "@/lib/members";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async (req) => {
  const ctx = await requireMobileAuth(req);

  const members = await db.member.findMany({
    where: { familyId: ctx.familyId },
    orderBy: { createdAt: "asc" },
  });

  return ok({
    members: members.map(serializeMember),
    me: { memberId: ctx.memberId, role: ctx.role },
  });
});

export const POST = withErrorHandling(async (req) => {
  const ctx = await requireMobileAuth(req);
  if (ctx.role !== "ADMIN") {
    throw new AppError("Only admins can add members", "NOT_ADMIN", 403);
  }

  const body = createMemberSchema.parse(await req.json());
  const created = await createMember(body);
  return ok({ member: serializeMember(created) }, { status: 201 });
});

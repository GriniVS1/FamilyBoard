import { AppError, ok, withErrorHandling } from "@/lib/api";
import { requireMobileAuth } from "@/lib/mobile-auth";
import {
  deleteMember,
  patchMemberSchema,
  serializeMember,
  updateMember,
} from "@/lib/members";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandling<Ctx>(async (req, { params }) => {
  const ctx = await requireMobileAuth(req);
  if (ctx.role !== "ADMIN") {
    throw new AppError("Only admins can edit members", "NOT_ADMIN", 403);
  }

  const { id } = await params;
  const body = patchMemberSchema.parse(await req.json());
  const updated = await updateMember(id, body, { familyId: ctx.familyId });
  return ok({ member: serializeMember(updated) });
});

export const DELETE = withErrorHandling<Ctx>(async (req, { params }) => {
  const ctx = await requireMobileAuth(req);
  if (ctx.role !== "ADMIN") {
    throw new AppError("Only admins can remove members", "NOT_ADMIN", 403);
  }

  const { id } = await params;
  await deleteMember(id, { familyId: ctx.familyId });
  return ok({ ok: true });
});

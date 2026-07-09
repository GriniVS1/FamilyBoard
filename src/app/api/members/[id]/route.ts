import { ok, withErrorHandling } from "@/lib/api";
import { deleteMember, patchMemberSchema, updateMember } from "@/lib/members";
import { requireAdminPin } from "@/lib/admin-pin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withErrorHandling<Ctx>(async (req, { params }) => {
  await requireAdminPin(req);
  const { id } = await params;
  const body = patchMemberSchema.parse(await req.json());
  const updated = await updateMember(id, body);
  return ok(updated);
});

export const DELETE = withErrorHandling<Ctx>(async (_req, { params }) => {
  await requireAdminPin(_req);
  const { id } = await params;
  await deleteMember(id);
  return ok({ ok: true });
});

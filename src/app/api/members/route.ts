import { ok, withErrorHandling } from "@/lib/api";
import { createMember, createMemberSchema } from "@/lib/members";
import { listMembers } from "@/lib/queries";
import { requireAdminPin } from "@/lib/admin-pin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const members = await listMembers();
  return ok(members);
});

export const POST = withErrorHandling(async (req) => {
  await requireAdminPin(req);
  const body = createMemberSchema.parse(await req.json());
  const created = await createMember(body);
  return ok(created);
});

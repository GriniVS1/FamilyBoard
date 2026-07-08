import { withErrorHandling, ok } from "@/lib/api";
import { requireAdminPin } from "@/lib/admin-pin";
import { disconnectCaldav } from "@/lib/calendar-connect";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withErrorHandling<Ctx>(async (req, { params }) => {
  await requireAdminPin(req);
  const { id } = await params;
  await disconnectCaldav(id);
  return ok({ ok: true });
});

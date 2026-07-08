import { withErrorHandling, ok } from "@/lib/api";
import { requireAdminPin } from "@/lib/admin-pin";
import { startMicrosoftConnect } from "@/lib/calendar-connect";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withErrorHandling<Ctx>(async (req, { params }) => {
  await requireAdminPin(req);
  const { id } = await params;
  const result = await startMicrosoftConnect(id);
  return ok(result);
});

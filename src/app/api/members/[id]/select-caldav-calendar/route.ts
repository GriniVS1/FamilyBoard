import { z } from "zod";
import { withErrorHandling, ok } from "@/lib/api";
import { requireAdminPin } from "@/lib/admin-pin";
import { selectCaldavCalendar } from "@/lib/calendar-connect";

export const runtime = "nodejs";

const bodySchema = z.object({
  calendarUrl: z.string().url(),
  calendarName: z.string().min(1),
});

type Ctx = { params: Promise<{ id: string }> };

export const POST = withErrorHandling<Ctx>(async (req, { params }) => {
  await requireAdminPin(req);
  const { id } = await params;
  const body = bodySchema.parse(await req.json());
  const result = await selectCaldavCalendar(id, body);
  return ok(result);
});

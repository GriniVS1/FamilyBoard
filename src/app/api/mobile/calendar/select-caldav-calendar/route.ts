import { z } from "zod";
import { withErrorHandling, ok } from "@/lib/api";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { selectCaldavCalendar } from "@/lib/calendar-connect";

export const runtime = "nodejs";

const bodySchema = z.object({
  calendarUrl: z.string().url(),
  calendarName: z.string().min(1),
});

export const POST = withErrorHandling(async (req) => {
  const { memberId } = await requireMobileAuth(req);
  const body = bodySchema.parse(await req.json());
  const result = await selectCaldavCalendar(memberId, body);
  return ok(result);
});

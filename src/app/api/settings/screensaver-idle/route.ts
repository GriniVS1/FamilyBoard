import { z } from "zod";
import { ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { getScreensaverIdleMinutes } from "@/lib/queries";

export const runtime = "nodejs";

export const GET = withErrorHandling(async () => {
  const minutes = await getScreensaverIdleMinutes();
  return ok({ minutes });
});

const PatchBody = z.object({
  minutes: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(3),
    z.literal(5),
    z.literal(10),
    z.literal(15),
    z.literal(30),
  ]),
});

export const PATCH = withErrorHandling(async (req) => {
  const body = PatchBody.parse(await req.json());
  await db.setting.upsert({
    where: { key: "screensaver_idle_minutes" },
    update: { value: String(body.minutes) },
    create: { key: "screensaver_idle_minutes", value: String(body.minutes) },
  });
  return ok({ minutes: body.minutes });
});

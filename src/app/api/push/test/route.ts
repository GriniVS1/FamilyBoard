import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { sendNotificationToFamily } from "@/lib/notifications";
import { getClientIp, hitRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  title: z.string().max(200).optional(),
  body: z.string().max(500).optional(),
});

export const POST = withErrorHandling(async (req) => {
  // Unauthenticated by design (settings toggle, no PIN header), so throttle to
  // stop it being abused as a push-spam relay to every family device.
  const ip = getClientIp(req.headers);
  const limit = hitRateLimit(`push-test:${ip}`, 5, 60_000);
  if (!limit.allowed) {
    throw new AppError(
      "Too many attempts. Please wait a minute.",
      "TOO_MANY_ATTEMPTS",
      429,
    );
  }

  const parsed = bodySchema.parse(await req.json());

  const family = await db.family.findFirst({ select: { id: true } });
  if (!family) throw new AppError("Family not found", "FAMILY_NOT_FOUND", 404);

  const result = await sendNotificationToFamily(family.id, {
    title: parsed.title ?? "FamilyBoard test",
    body: parsed.body ?? "Push notifications are working",
    tag: "test",
  });

  return ok(result);
});

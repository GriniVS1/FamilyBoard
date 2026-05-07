import { z } from "zod";
import { ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { requireMobileAuth } from "@/lib/mobile-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  fcmToken: z.string().min(1).nullable().optional(),
  apnsToken: z.string().min(1).nullable().optional(),
});

export const POST = withErrorHandling(async (req) => {
  const ctx = await requireMobileAuth(req);
  const body = bodySchema.parse(await req.json());

  await db.mobileDevice.update({
    where: { id: ctx.deviceId },
    data: {
      ...(body.fcmToken !== undefined ? { fcmToken: body.fcmToken } : {}),
      ...(body.apnsToken !== undefined ? { apnsToken: body.apnsToken } : {}),
    },
  });

  return ok({ ok: true });
});

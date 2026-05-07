import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  deviceLabel: z.string().max(100).optional(),
});

const deleteSchema = z.object({
  endpoint: z.string().url(),
});

export const POST = withErrorHandling(async (req) => {
  const body = subscribeSchema.parse(await req.json());

  const family = await db.family.findFirst({ select: { id: true } });
  if (!family) throw new AppError("Family not found", "FAMILY_NOT_FOUND", 404);

  await db.pushSubscription.upsert({
    where: { endpoint: body.endpoint },
    create: {
      familyId: family.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      deviceLabel: body.deviceLabel ?? null,
    },
    update: {
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      deviceLabel: body.deviceLabel ?? null,
    },
  });

  return ok({ ok: true });
});

export const DELETE = withErrorHandling(async (req) => {
  const body = deleteSchema.parse(await req.json());

  await db.pushSubscription.deleteMany({
    where: { endpoint: body.endpoint },
  });

  return ok({ ok: true });
});

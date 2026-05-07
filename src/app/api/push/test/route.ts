import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { sendNotificationToFamily } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  title: z.string().max(200).optional(),
  body: z.string().max(500).optional(),
});

export const POST = withErrorHandling(async (req) => {
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

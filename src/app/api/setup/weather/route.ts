import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { assertSetupIncomplete } from "@/lib/setup-guard";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  label: z.string().trim().min(1).max(80),
});

export const POST = withErrorHandling(async (req) => {
  await assertSetupIncomplete();
  const json = await req.json();
  const { lat, lon, label } = bodySchema.parse(json);

  const family = await db.family.findFirst();
  if (!family) {
    throw new AppError(
      "Create a family before setting weather",
      "FAMILY_NOT_FOUND",
      400,
    );
  }

  const updated = await db.family.update({
    where: { id: family.id },
    data: { weatherLat: lat, weatherLon: lon, weatherLabel: label },
  });

  return ok(updated);
});

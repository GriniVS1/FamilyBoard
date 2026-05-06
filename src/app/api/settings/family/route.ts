import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    weatherLat: z.number().min(-90).max(90).optional(),
    weatherLon: z.number().min(-180).max(180).optional(),
    weatherLabel: z.string().trim().min(1).max(80).optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.weatherLat !== undefined ||
      v.weatherLon !== undefined ||
      v.weatherLabel !== undefined,
    { message: "At least one field must be provided" },
  );

export const PATCH = withErrorHandling(async (req) => {
  const body = bodySchema.parse(await req.json());

  const family = await db.family.findFirst();
  if (!family) {
    throw new AppError("Family not found", "FAMILY_NOT_FOUND", 400);
  }

  const updated = await db.family.update({
    where: { id: family.id },
    data: {
      name: body.name,
      weatherLat: body.weatherLat,
      weatherLon: body.weatherLon,
      weatherLabel: body.weatherLabel,
    },
  });

  return ok(updated);
});

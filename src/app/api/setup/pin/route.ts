import { z } from "zod";
import { ok, withErrorHandling } from "@/lib/api";
import { setAdminPin } from "@/lib/pin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4-6 digits"),
});

export const POST = withErrorHandling(async (req) => {
  const json = await req.json();
  const { pin } = bodySchema.parse(json);
  await setAdminPin(pin);
  return ok({ ok: true });
});

import { z } from "zod";
import { ok, withErrorHandling } from "@/lib/api";
import { checkAdminPin } from "@/lib/admin-pin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  pin: z.string().min(1).max(12),
});

export const POST = withErrorHandling(async (req) => {
  const { pin } = bodySchema.parse(await req.json());
  const valid = await checkAdminPin(req, pin);
  return ok({ ok: valid });
});

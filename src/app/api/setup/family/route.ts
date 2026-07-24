import { z } from "zod";
import { ok, withErrorHandling } from "@/lib/api";
import { assertSetupIncomplete } from "@/lib/setup-guard";
import { createFamilyIfMissing } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Family name is required")
    .max(60, "Family name must be 60 characters or fewer"),
});

export const POST = withErrorHandling(async (req) => {
  await assertSetupIncomplete();
  const json = await req.json();
  const { name } = bodySchema.parse(json);
  const family = await createFamilyIfMissing(name);
  return ok(family);
});

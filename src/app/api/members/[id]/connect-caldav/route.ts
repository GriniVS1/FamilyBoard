import { z } from "zod";
import { withErrorHandling, ok } from "@/lib/api";
import { requireAdminPin } from "@/lib/admin-pin";
import { connectCaldav } from "@/lib/calendar-connect";

export const runtime = "nodejs";

const bodySchema = z.object({
  serverUrl: z.string().url(),
  username: z.string().min(1),
  password: z.string().min(1),
  preset: z
    .enum(["icloud", "fastmail", "nextcloud", "yahoo", "custom"] as const)
    .optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export const POST = withErrorHandling<Ctx>(async (req, { params }) => {
  await requireAdminPin(req);
  const { id } = await params;
  const body = bodySchema.parse(await req.json());
  const result = await connectCaldav(id, body);
  return ok(result);
});

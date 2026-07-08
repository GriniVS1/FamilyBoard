import { z } from "zod";
import { ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { requireAdminPin } from "@/lib/admin-pin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const row = await db.setting.findUnique({ where: { key: "remote_access_enabled" } });
  return ok({ enabled: row ? row.value === "true" : true });
});

const PatchBody = z.object({ enabled: z.boolean() });

export const PATCH = withErrorHandling(async (req) => {
  await requireAdminPin(req);
  const body = PatchBody.parse(await req.json());
  await db.setting.upsert({
    where: { key: "remote_access_enabled" },
    update: { value: String(body.enabled) },
    create: { key: "remote_access_enabled", value: String(body.enabled) },
  });
  return ok({ enabled: body.enabled });
});

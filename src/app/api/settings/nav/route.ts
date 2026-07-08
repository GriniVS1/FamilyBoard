import { z } from "zod";
import { ok, withErrorHandling } from "@/lib/api";
import { NAV_KEYS, getNavConfig, setNavConfig } from "@/lib/nav-config";
import { requireAdminPin } from "@/lib/admin-pin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET is unauthenticated: the shell needs the nav before any PIN exists.
export const GET = withErrorHandling(async () => {
  return ok({ items: await getNavConfig() });
});

const PatchBody = z.object({
  items: z
    .array(
      z.object({
        key: z.enum(NAV_KEYS),
        enabled: z.boolean(),
      }),
    )
    .max(NAV_KEYS.length * 2),
});

export const PATCH = withErrorHandling(async (req) => {
  await requireAdminPin(req);
  const body = PatchBody.parse(await req.json());
  return ok({ items: await setNavConfig(body.items) });
});

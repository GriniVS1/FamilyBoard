import { ok, withErrorHandling } from "@/lib/api";
import { getVapidKeys } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const { publicKey } = await getVapidKeys();
  return ok({ key: publicKey });
});

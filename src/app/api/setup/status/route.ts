import { ok, withErrorHandling } from "@/lib/api";
import { getSetupStatus } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const status = await getSetupStatus();
  return ok(status);
});

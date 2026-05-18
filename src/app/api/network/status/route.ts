import { withErrorHandling, ok } from "@/lib/api";
import { getNetworkStatus } from "@/lib/network";
import { requireNetworkAccess } from "../guard";

export const runtime = "nodejs";

export const GET = withErrorHandling(async (req) => {
  await requireNetworkAccess(req);
  const status = await getNetworkStatus();
  return ok(status);
});

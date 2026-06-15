import { withErrorHandling, ok, AppError } from "@/lib/api";
import { scanWifi, getCachedScan, NetworkError } from "@/lib/network";
import { requireNetworkAccess } from "../guard";

export const runtime = "nodejs";

export const GET = withErrorHandling(async (req) => {
  await requireNetworkAccess(req);

  const { searchParams } = new URL(req.url);
  if (searchParams.get("cached") === "1") {
    return ok({ networks: getCachedScan() });
  }

  try {
    const networks = await scanWifi();
    return ok({ networks });
  } catch (err) {
    if (err instanceof NetworkError) {
      throw new AppError(err.message, err.code, 502);
    }
    throw err;
  }
});

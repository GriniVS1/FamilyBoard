import { withErrorHandling, ok, AppError } from "@/lib/api";
import { stopHotspot, NetworkError } from "@/lib/network";
import { requireNetworkAccess } from "../guard";

export const runtime = "nodejs";

export const POST = withErrorHandling(async (req) => {
  await requireNetworkAccess(req);
  try {
    await stopHotspot();
  } catch (err) {
    if (err instanceof NetworkError) {
      throw new AppError(err.message, err.code, 502);
    }
    throw err;
  }
  return ok({ ok: true });
});

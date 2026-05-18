import { z } from "zod";
import { withErrorHandling, ok, AppError } from "@/lib/api";
import { startHotspot, NetworkError } from "@/lib/network";
import { requireNetworkAccess } from "../guard";

export const runtime = "nodejs";

// Body is intentionally empty — all params are server-generated.
const schema = z.object({}).strict();

export const POST = withErrorHandling(async (req) => {
  await requireNetworkAccess(req);
  const text = await req.text();
  if (text) schema.parse(JSON.parse(text));

  try {
    const result = await startHotspot();
    return ok(result);
  } catch (err) {
    if (err instanceof NetworkError) {
      throw new AppError(err.message, err.code, 502);
    }
    throw err;
  }
});

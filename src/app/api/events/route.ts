import { withErrorHandling, ok, AppError } from "@/lib/api";
import { fetchExpandedEventRows } from "@/lib/events-read";
import { createEvent, createEventSchema } from "@/lib/events-write";

export const runtime = "nodejs";

export const GET = withErrorHandling(async (req) => {
  const url = new URL(req.url);
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const memberIdsStr = url.searchParams.get("memberIds");

  if (!fromStr || !toStr) {
    throw new AppError("from and to are required", "MISSING_RANGE", 400);
  }
  const from = new Date(fromStr);
  const to = new Date(toStr);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new AppError("from/to must be ISO datetimes", "INVALID_RANGE", 400);
  }

  const memberIds = memberIdsStr
    ? memberIdsStr.split(",").map((s) => s.trim()).filter(Boolean)
    : null;

  const filtered = await fetchExpandedEventRows(
    { from, to, memberIds },
    { overrides: true },
  );

  return ok(filtered);
});

export const POST = withErrorHandling(async (req) => {
  const body = createEventSchema.parse(await req.json());
  const event = await createEvent(body);
  return ok(event);
});

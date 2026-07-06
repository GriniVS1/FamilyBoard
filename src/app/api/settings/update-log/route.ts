import { ok, withErrorHandling } from "@/lib/api";
import { readUpdateLog } from "@/lib/update-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Tail of the host OTA updater's log so the wall UI can show what happened
// during an update — no SSH needed. Read-only, no secrets in the log.
export const GET = withErrorHandling(async () => {
  return ok(readUpdateLog());
});

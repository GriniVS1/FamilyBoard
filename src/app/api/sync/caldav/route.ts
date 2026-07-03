import { withErrorHandling, ok } from "@/lib/api";
import { requireInternalOrAdmin } from "@/lib/internal-auth";
import { runCaldavSyncForAllMembers } from "@/lib/caldav";

export const runtime = "nodejs";

export const POST = withErrorHandling(async (req) => {
  await requireInternalOrAdmin(req);
  const counts = await runCaldavSyncForAllMembers();
  return ok(counts);
});

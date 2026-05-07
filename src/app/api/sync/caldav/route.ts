import { withErrorHandling, ok } from "@/lib/api";
import { runCaldavSyncForAllMembers } from "@/lib/caldav";

export const runtime = "nodejs";

export const POST = withErrorHandling(async () => {
  const counts = await runCaldavSyncForAllMembers();
  return ok(counts);
});

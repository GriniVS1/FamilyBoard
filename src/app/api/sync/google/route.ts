import { withErrorHandling, ok } from "@/lib/api";
import { runGoogleSyncForAllMembers } from "@/lib/sync";

export const runtime = "nodejs";

export const POST = withErrorHandling(async () => {
  const counts = await runGoogleSyncForAllMembers();
  return ok(counts);
});

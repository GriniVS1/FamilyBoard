import { withErrorHandling, ok } from "@/lib/api";
import { runMicrosoftSyncForAllMembers } from "@/lib/microsoft";

export const runtime = "nodejs";

export const POST = withErrorHandling(async () => {
  const counts = await runMicrosoftSyncForAllMembers();
  return ok(counts);
});

import { withErrorHandling, ok } from "@/lib/api";
import { requireInternalOrAdmin } from "@/lib/internal-auth";
import { runGoogleSyncForAllMembers } from "@/lib/sync";

export const runtime = "nodejs";

export const POST = withErrorHandling(async (req) => {
  await requireInternalOrAdmin(req);
  const counts = await runGoogleSyncForAllMembers();
  return ok(counts);
});

import { withErrorHandling, ok } from "@/lib/api";
import { requireInternalOrAdmin } from "@/lib/internal-auth";
import { runMicrosoftSyncForAllMembers } from "@/lib/microsoft";

export const runtime = "nodejs";

export const POST = withErrorHandling(async (req) => {
  await requireInternalOrAdmin(req);
  const counts = await runMicrosoftSyncForAllMembers();
  return ok(counts);
});

import { ok, withErrorHandling } from "@/lib/api";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { deletePhotoById } from "@/lib/photos-store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = withErrorHandling<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const ctx = await requireMobileAuth(req);

  await deletePhotoById(id, ctx.familyId);
  return ok({ ok: true });
});

import { ok, withErrorHandling } from "@/lib/api";
import { deletePhotoById } from "@/lib/photos-store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = withErrorHandling<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  await deletePhotoById(id);
  return ok({ ok: true });
});

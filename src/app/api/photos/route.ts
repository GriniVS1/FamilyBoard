import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import {
  listPhotosForFamily,
  normalizePhotoCaption,
  saveUploadedPhoto,
} from "@/lib/photos-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const family = await db.family.findFirst();
  if (!family) return ok([]);

  const photos = await listPhotosForFamily(family.id);
  return ok(photos);
});

export const POST = withErrorHandling(async (req) => {
  const family = await db.family.findFirst();
  if (!family) {
    throw new AppError(
      "Create a family before uploading photos",
      "FAMILY_NOT_FOUND",
      400,
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  const captionRaw = form.get("caption");

  if (!(file instanceof File)) {
    throw new AppError("file field is required", "MISSING_FILE", 400);
  }

  const photo = await saveUploadedPhoto({
    familyId: family.id,
    file,
    caption: normalizePhotoCaption(captionRaw),
  });

  return ok(photo);
});

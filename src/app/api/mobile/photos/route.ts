import { AppError, ok, withErrorHandling } from "@/lib/api";
import { requireMobileAuth } from "@/lib/mobile-auth";
import {
  listPhotosForFamily,
  normalizePhotoCaption,
  saveUploadedPhoto,
  type PhotoRecord,
} from "@/lib/photos-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serializePhoto(photo: PhotoRecord) {
  return {
    id: photo.id,
    path: photo.path,
    caption: photo.caption,
    uploadedAt: photo.uploadedAt.toISOString(),
  };
}

export const GET = withErrorHandling(async (req) => {
  const ctx = await requireMobileAuth(req);

  const photos = await listPhotosForFamily(ctx.familyId);
  return ok({ photos: photos.map(serializePhoto) });
});

export const POST = withErrorHandling(async (req) => {
  const ctx = await requireMobileAuth(req);

  const form = await req.formData();
  const file = form.get("file");
  const captionRaw = form.get("caption");

  if (!(file instanceof File)) {
    throw new AppError("file field is required", "MISSING_FILE", 400);
  }

  const photo = await saveUploadedPhoto({
    familyId: ctx.familyId,
    file,
    caption: normalizePhotoCaption(captionRaw),
  });

  return ok({ photo: serializePhoto(photo) }, { status: 201 });
});

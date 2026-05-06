import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import {
  PHOTO_MAX_BYTES,
  PHOTO_MIME_TO_EXT,
  getPhotosDir,
} from "@/lib/photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const family = await db.family.findFirst();
  if (!family) return ok([]);

  const photos = await db.photo.findMany({
    where: { familyId: family.id },
    orderBy: { uploadedAt: "desc" },
  });

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

  const ext = PHOTO_MIME_TO_EXT[file.type];
  if (!ext) {
    throw new AppError(
      "Unsupported image type. Allowed: jpeg, png, webp, gif",
      "UNSUPPORTED_TYPE",
      400,
    );
  }

  if (file.size > PHOTO_MAX_BYTES) {
    throw new AppError(
      `Photo exceeds ${PHOTO_MAX_BYTES} bytes`,
      "PHOTO_TOO_LARGE",
      400,
    );
  }

  const caption =
    typeof captionRaw === "string" && captionRaw.trim().length > 0
      ? captionRaw.trim().slice(0, 500)
      : null;

  const buffer = Buffer.from(await file.arrayBuffer());
  const photosDir = getPhotosDir();
  await mkdir(photosDir, { recursive: true });

  const filename = `${randomBytes(16).toString("hex")}.${ext}`;
  const fullPath = path.join(photosDir, filename);
  await writeFile(fullPath, buffer);

  const photo = await db.photo.create({
    data: {
      familyId: family.id,
      path: `/api/photos-stream/${filename}`,
      caption,
    },
  });

  return ok(photo);
});

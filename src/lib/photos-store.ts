import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppError } from "@/lib/api";
import { db } from "@/lib/db";
import {
  PHOTO_FILENAME_RE,
  PHOTO_MAX_BYTES,
  PHOTO_MIME_TO_EXT,
  getPhotosDir,
} from "@/lib/photos";

export type PhotoRecord = {
  id: string;
  familyId: string;
  path: string;
  caption: string | null;
  uploadedAt: Date;
};

const STREAM_PREFIX = "/api/photos-stream/";
// Rows written before the stream route moved under /api/ still carry this prefix.
const LEGACY_STREAM_PREFIX = "/photos-stream/";

export function extractPhotoFilename(photoPath: string): string | null {
  const filename = photoPath.startsWith(STREAM_PREFIX)
    ? photoPath.slice(STREAM_PREFIX.length)
    : photoPath.startsWith(LEGACY_STREAM_PREFIX)
      ? photoPath.slice(LEGACY_STREAM_PREFIX.length)
      : null;
  return filename && PHOTO_FILENAME_RE.test(filename) ? filename : null;
}

export async function unlinkPhotoFile(filename: string): Promise<void> {
  const photosDir = getPhotosDir();
  const fullPath = path.resolve(path.join(photosDir, filename));
  if (!fullPath.startsWith(path.resolve(photosDir) + path.sep)) return;

  try {
    await unlink(fullPath);
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? (err as { code?: string }).code
        : undefined;
    if (code !== "ENOENT") {
      console.warn("[photos] failed to remove file", filename);
    }
  }
}

export function normalizePhotoCaption(
  raw: FormDataEntryValue | null,
): string | null {
  return typeof raw === "string" && raw.trim().length > 0
    ? raw.trim().slice(0, 500)
    : null;
}

export async function listPhotosForFamily(
  familyId: string,
): Promise<PhotoRecord[]> {
  return db.photo.findMany({
    where: { familyId },
    orderBy: { uploadedAt: "desc" },
  });
}

export async function saveUploadedPhoto(params: {
  familyId: string;
  file: File;
  caption: string | null;
}): Promise<PhotoRecord> {
  const { familyId, file, caption } = params;

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

  const buffer = Buffer.from(await file.arrayBuffer());
  const photosDir = getPhotosDir();
  await mkdir(photosDir, { recursive: true });

  const filename = `${randomBytes(16).toString("hex")}.${ext}`;
  await writeFile(path.join(photosDir, filename), buffer);

  return db.photo.create({
    data: {
      familyId,
      path: `${STREAM_PREFIX}${filename}`,
      caption,
    },
  });
}

export async function deletePhotoById(
  id: string,
  familyId?: string,
): Promise<void> {
  const photo = await db.photo.findUnique({ where: { id } });
  if (!photo || (familyId !== undefined && photo.familyId !== familyId)) {
    throw new AppError("Photo not found", "PHOTO_NOT_FOUND", 404);
  }

  await db.photo.delete({ where: { id } });

  const filename = extractPhotoFilename(photo.path);
  if (filename) {
    await unlinkPhotoFile(filename);
  }
}

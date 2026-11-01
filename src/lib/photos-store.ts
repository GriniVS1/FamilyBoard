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

// The declared multipart type is client-chosen, so the stored format comes from
// the bytes: an AVIF/TIFF/SVG upload declared as image/jpeg must not be stored
// (and later served or decoded) as a photo.
function sniffPhotoExt(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (
    buf.length >= 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "png";
  }
  if (buf.length >= 6 && /^GIF8[79]a$/.test(buf.toString("latin1", 0, 6))) return "gif";
  if (
    buf.length >= 12 &&
    buf.toString("latin1", 0, 4) === "RIFF" &&
    buf.toString("latin1", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  return null;
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
  const sniffedExt = sniffPhotoExt(buffer);
  if (!sniffedExt) {
    throw new AppError(
      "Unsupported image type. Allowed: jpeg, png, webp, gif",
      "UNSUPPORTED_TYPE",
      400,
    );
  }

  const photosDir = getPhotosDir();
  await mkdir(photosDir, { recursive: true });

  const filename = `${randomBytes(16).toString("hex")}.${sniffedExt}`;
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

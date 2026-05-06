import { unlink } from "node:fs/promises";
import path from "node:path";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { PHOTO_FILENAME_RE, getPhotosDir } from "@/lib/photos";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = withErrorHandling<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const photo = await db.photo.findUnique({ where: { id } });
  if (!photo) throw new AppError("Photo not found", "PHOTO_NOT_FOUND", 404);

  const filename = photo.path.startsWith("/photos-stream/")
    ? photo.path.slice("/photos-stream/".length)
    : null;

  await db.photo.delete({ where: { id } });

  if (filename && PHOTO_FILENAME_RE.test(filename)) {
    const fullPath = path.join(getPhotosDir(), filename);
    try {
      await unlink(fullPath);
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? (err as { code?: string }).code
          : undefined;
      if (code !== "ENOENT") {
        console.warn("[photos] failed to remove file", fullPath, err);
      }
    }
  }

  return ok({ ok: true });
});

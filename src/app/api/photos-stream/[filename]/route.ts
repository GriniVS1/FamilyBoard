import { stat, readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { fail, withErrorHandling } from "@/lib/api";
import {
  PHOTO_EXT_TO_MIME,
  PHOTO_FILENAME_RE,
  getPhotosDir,
} from "@/lib/photos";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ filename: string }> };

export const GET = withErrorHandling<Ctx>(async (_req, { params }) => {
  const { filename } = await params;

  if (
    !filename ||
    filename.includes("/") ||
    filename.includes("..") ||
    filename.includes("\\") ||
    !PHOTO_FILENAME_RE.test(filename)
  ) {
    return fail("INVALID_FILENAME", "Invalid filename", 400);
  }

  const photosDir = getPhotosDir();
  const fullPath = path.join(photosDir, filename);
  const resolved = path.resolve(fullPath);
  if (!resolved.startsWith(path.resolve(photosDir) + path.sep)) {
    return fail("INVALID_FILENAME", "Invalid filename", 400);
  }

  try {
    await stat(resolved);
  } catch {
    return fail("PHOTO_NOT_FOUND", "Photo not found", 404);
  }

  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const mime = PHOTO_EXT_TO_MIME[ext] ?? "application/octet-stream";
  const buffer = await readFile(resolved);
  const body = new Uint8Array(buffer);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Cache-Control": "public, max-age=3600",
      "Content-Length": String(buffer.byteLength),
      "X-Content-Type-Options": "nosniff",
    },
  });
});

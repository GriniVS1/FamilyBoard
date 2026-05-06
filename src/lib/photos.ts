import path from "node:path";

export const PHOTO_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const PHOTO_EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;

export const PHOTO_FILENAME_RE = /^[a-zA-Z0-9]+\.(jpg|jpeg|png|webp|gif)$/;

export function getDataDir(): string {
  return process.env.NODE_ENV === "production"
    ? "/app/data"
    : path.resolve(process.cwd(), "data");
}

export function getPhotosDir(): string {
  return path.join(getDataDir(), "photos");
}

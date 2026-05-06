export type Photo = {
  id: string;
  familyId: string;
  path: string;
  caption: string | null;
  filename?: string;
  width?: number | null;
  height?: number | null;
  createdAt?: string;
  uploadedAt?: string;
};

export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;

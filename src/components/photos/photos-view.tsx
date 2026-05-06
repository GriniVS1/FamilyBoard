"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/shared/button";
import { GlassCard } from "@/components/shared/glass-card";
import { cn } from "@/lib/utils";
import type { Photo } from "./types";
import { PHOTO_MAX_BYTES } from "./types";

type PhotosViewProps = Record<string, never>;

const QUERY_KEY: QueryKey = ["photos"];

async function fetchPhotos(): Promise<Photo[]> {
  const res = await fetch("/api/photos", { cache: "no-store" });
  if (!res.ok) {
    let message = `Failed to load photos (${res.status})`;
    try {
      const data = (await res.json()) as { error?: { message?: string } };
      if (data?.error?.message) message = data.error.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return (await res.json()) as Photo[];
}

async function uploadPhoto(file: File, caption?: string): Promise<Photo> {
  const fd = new FormData();
  fd.append("file", file);
  if (caption) fd.append("caption", caption);
  const res = await fetch("/api/photos", { method: "POST", body: fd });
  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: { message?: string } };
      if (data?.error?.message) message = data.error.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return (await res.json()) as Photo;
}

async function deletePhoto(id: string): Promise<{ ok: true }> {
  const res = await fetch(`/api/photos/${id}`, { method: "DELETE" });
  if (!res.ok) {
    let message = `Delete failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: { message?: string } };
      if (data?.error?.message) message = data.error.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return (await res.json()) as { ok: true };
}

export function PhotosView(_: PhotosViewProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { data: photos = [], isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchPhotos,
  });

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadPhoto(file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : "Upload failed.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePhoto(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<Photo[]>(QUERY_KEY) ?? [];
      queryClient.setQueryData<Photo[]>(
        QUERY_KEY,
        previous.filter((p) => p.id !== id),
      );
      return { previous };
    },
    onError: (err, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(QUERY_KEY, ctx.previous);
      showToast(err instanceof Error ? err.message : "Could not delete.");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-selecting same file
    if (files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          showToast(`${file.name} isn't an image.`);
          continue;
        }
        if (file.size > PHOTO_MAX_BYTES) {
          showToast(`${file.name} is over 8 MB.`);
          continue;
        }
        try {
          await uploadMutation.mutateAsync(file);
        } catch {
          // already toasted in onError; continue with next
        }
      }
    } finally {
      setUploading(false);
    }
  }

  function handleDelete(photo: Photo) {
    if (!window.confirm("Delete this photo?")) return;
    deleteMutation.mutate(photo.id);
  }

  function pickFiles() {
    inputRef.current?.click();
  }

  const isEmpty = !isLoading && photos.length === 0 && !error;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl tracking-tight text-ink sm:text-3xl">
          Photos
        </h2>
        <div className="flex items-center gap-2">
          {uploading && (
            <span className="inline-flex items-center gap-2 text-sm text-muted">
              <Loader2 className="size-4 animate-spin" />
              Uploading…
            </span>
          )}
          <Button onClick={pickFiles} disabled={uploading}>
            <Upload className="size-5" />
            Upload photo
          </Button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={handleFileChange}
      />

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-accent-rose/40 bg-accent-rose/10 px-4 py-3 text-sm text-ink"
        >
          {error instanceof Error ? error.message : "Could not load photos."}
        </div>
      )}

      {isEmpty ? (
        <EmptyState onUpload={pickFiles} />
      ) : (
        <ul
          className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4"
          aria-label="Photos"
        >
          {photos.map((p) => (
            <PhotoTile key={p.id} photo={p} onDelete={handleDelete} />
          ))}
        </ul>
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm rounded-2xl border border-accent-rose/40 bg-surface px-4 py-3 text-sm text-ink shadow-lift md:bottom-8"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

type PhotoTileProps = {
  photo: Photo;
  onDelete: (photo: Photo) => void;
};

function PhotoTile({ photo, onDelete }: PhotoTileProps) {
  return (
    <li
      className={cn(
        "group relative aspect-square overflow-hidden rounded-3xl border border-border bg-bg shadow-soft",
      )}
    >
      <motion.img
        src={photo.path}
        alt={photo.caption ?? "Family photo"}
        loading="lazy"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="size-full object-cover"
      />

      {photo.caption && (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 px-3 py-2",
            "bg-gradient-to-t from-ink/60 to-transparent",
            "opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
          )}
        >
          <p className="line-clamp-2 text-xs text-bg">{photo.caption}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => onDelete(photo)}
        aria-label="Delete photo"
        className={cn(
          "absolute right-2 top-2 size-12 tap-target inline-flex items-center justify-center rounded-full",
          "bg-surface/90 text-accent-rose shadow-soft backdrop-blur-sm",
          "opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20",
        )}
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <GlassCard className="mx-auto flex w-full max-w-md flex-col items-center gap-4 p-10 text-center">
      <span
        className="inline-flex size-20 items-center justify-center rounded-full bg-accent-sky/30 text-ink"
        aria-hidden
      >
        <ImagePlus className="size-9" />
      </span>
      <h3 className="font-display text-2xl tracking-tight text-ink">
        Add your first photo
      </h3>
      <p className="text-sm text-muted">
        Photos appear in the screensaver and on the dashboard.
      </p>
      <Button onClick={onUpload}>
        <Upload className="size-5" />
        Upload photo
      </Button>
    </GlassCard>
  );
}

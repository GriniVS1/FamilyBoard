"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Loader2, Trash2, Upload } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/kids/confirm-dialog";
import { KidToast } from "@/components/kids/kid-toast";
import { EmptyState, ErrorState, Skeleton } from "@/components/kids/state-views";
import { Button } from "@/components/shared/button";
import { cn } from "@/lib/utils";
import type { Photo } from "./types";
import { PHOTO_MAX_BYTES } from "./types";

type PhotosViewProps = Record<string, never>;

const QUERY_KEY: QueryKey = ["photos"];

async function fetchPhotos(): Promise<Photo[]> {
  const res = await fetch("/api/photos", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`photos ${res.status}`);
  }
  return (await res.json()) as Photo[];
}

async function uploadPhoto(file: File, caption?: string): Promise<Photo> {
  const fd = new FormData();
  fd.append("file", file);
  if (caption) fd.append("caption", caption);
  const res = await fetch("/api/photos", { method: "POST", body: fd });
  if (!res.ok) {
    throw new Error(`upload ${res.status}`);
  }
  return (await res.json()) as Photo;
}

async function deletePhoto(id: string): Promise<{ ok: true }> {
  const res = await fetch(`/api/photos/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`delete ${res.status}`);
  }
  return (await res.json()) as { ok: true };
}

export function PhotosView(_: PhotosViewProps) {
  const t = useTranslations("photos");
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Photo | null>(null);

  const { data: photos = [], isLoading, isError, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchPhotos,
  });

  function showToast(msg: string) {
    setToast(msg);
  }

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadPhoto(file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: () => {
      showToast(t("uploadFailed"));
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
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(QUERY_KEY, ctx.previous);
      showToast(t("couldNotDelete"));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          showToast(t("notAnImage", { name: file.name }));
          continue;
        }
        if (file.size > PHOTO_MAX_BYTES) {
          showToast(t("tooLarge", { name: file.name }));
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

  async function confirmDelete(photo: Photo) {
    await deleteMutation.mutateAsync(photo.id);
  }

  function pickFiles() {
    inputRef.current?.click();
  }

  const isEmpty = !isLoading && photos.length === 0 && !isError;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {t("title")}
        </h2>
        <div className="flex items-center gap-2">
          {uploading && (
            <span className="kid-label inline-flex items-center gap-2 text-muted">
              <Loader2 className="size-4 motion-safe:animate-spin" />
              {t("uploading")}
            </span>
          )}
          <Button onClick={pickFiles} disabled={uploading}>
            <Upload className="size-5" strokeWidth={2.5} />
            {t("upload")}
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

      {isLoading && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-square rounded-3xl" />
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <ErrorState onRetry={() => void refetch()} detail={t("couldNotLoad")} />
      )}

      {isEmpty && (
        <EmptyState
          picto="nav-photos"
          title={t("empty")}
          description={t("emptyDesc")}
          onCreate={pickFiles}
          createLabel={t("upload")}
        />
      )}

      {!isLoading && !isError && !isEmpty && (
        <ul
          className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4"
          aria-label={t("title")}
        >
          {photos.map((p) => (
            <PhotoTile key={p.id} photo={p} onDelete={setDeleteTarget} />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t("deleteConfirm")}
        preview={
          deleteTarget ? (
            <motion.img
              src={deleteTarget.path}
              alt=""
              className="size-24 rounded-2xl border border-border object-cover"
            />
          ) : null
        }
        onConfirm={() => (deleteTarget ? confirmDelete(deleteTarget) : undefined)}
      />

      {toast && (
        <KidToast tone="error" picto="oops" durationMs={8000} onDismiss={() => setToast(null)}>
          {toast}
        </KidToast>
      )}
    </div>
  );
}

type PhotoTileProps = {
  photo: Photo;
  onDelete: (photo: Photo) => void;
};

function PhotoTile({ photo, onDelete }: PhotoTileProps) {
  const t = useTranslations("photos");

  return (
    <li
      className={cn(
        "relative aspect-square overflow-hidden rounded-3xl border border-border bg-bg shadow-soft",
      )}
    >
      <motion.img
        src={photo.path}
        alt={photo.caption ?? t("familyPhoto")}
        loading="lazy"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="size-full object-cover"
      />

      {photo.caption && (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 px-3 pb-2 pt-6",
            "bg-gradient-to-t from-[hsl(var(--shadow)/0.7)] to-transparent",
          )}
        >
          <p className="kid-label line-clamp-2 text-[hsl(var(--picto-shine))]">{photo.caption}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => onDelete(photo)}
        aria-label={t("deletePhoto")}
        className={cn(
          "absolute right-2 top-2 inline-flex size-12 items-center justify-center rounded-full",
          "border border-danger/40 bg-surface/90 text-danger-ink shadow-soft backdrop-blur-sm",
          "focus-ring-kid",
        )}
      >
        <Trash2 className="size-5" />
      </button>
    </li>
  );
}

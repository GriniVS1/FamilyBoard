"use client";

import { Plus, RotateCw } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Picto, type PictoName } from "@/components/pictos";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  picto?: PictoName;
  title?: string;
  /** Adult hint below the title; keep it to one line. */
  description?: string;
  /** Only pass when the current viewer may create something here. */
  onCreate?: () => void;
  createLabel?: string;
  size?: "md" | "lg";
  className?: string;
  children?: ReactNode;
};

export function EmptyState({
  picto = "relax",
  title,
  description,
  onCreate,
  createLabel,
  size = "lg",
  className,
  children,
}: EmptyStateProps) {
  const t = useTranslations("kids");
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-border bg-surface/60 text-center",
        size === "lg" ? "p-8" : "p-5",
        className,
      )}
    >
      <Picto name={picto} size={size === "lg" ? 120 : 80} />
      {title && <p className="kid-title text-ink">{title}</p>}
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {children}
      {onCreate && (
        <button
          type="button"
          onClick={onCreate}
          aria-label={createLabel ?? t("add")}
          className={cn(
            "mt-1 inline-flex h-16 min-w-16 items-center justify-center gap-2 rounded-full px-6",
            "bg-accent-sky text-on-accent shadow-pop kid-title focus-ring-kid",
            "transition-transform duration-100 ease-snappy active:translate-y-0.5 active:shadow-press",
          )}
        >
          <Plus className="size-7" strokeWidth={2.75} />
          {createLabel && <span>{createLabel}</span>}
        </button>
      )}
    </div>
  );
}

type ErrorStateProps = {
  onRetry: () => void;
  /** Short localized adult line — never a raw server message. */
  detail?: string;
  size?: "md" | "lg";
  className?: string;
};

export function ErrorState({ onRetry, detail, size = "lg", className }: ErrorStateProps) {
  const t = useTranslations("kids");
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-danger/40 bg-danger-tint/60 text-center",
        size === "lg" ? "p-8" : "p-5",
        className,
      )}
    >
      <Picto name="oops" size={size === "lg" ? 120 : 80} />
      <button
        type="button"
        onClick={onRetry}
        aria-label={t("retry")}
        className={cn(
          "inline-flex size-16 items-center justify-center rounded-full",
          "bg-surface text-ink shadow-pop focus-ring-kid",
          "transition-transform duration-100 ease-snappy active:translate-y-0.5 active:shadow-press",
        )}
      >
        <RotateCw className="size-8" strokeWidth={2.5} />
      </button>
      <p className="text-sm text-danger-ink">{detail ?? t("errorGeneric")}</p>
    </div>
  );
}

type SkeletonProps = {
  className?: string;
};

/** Match the final element's shape exactly so nothing jumps when data arrives. */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "rounded-2xl bg-ink/5 dark:bg-ink/10",
        "bg-[linear-gradient(90deg,transparent,hsl(var(--surface)/0.6),transparent)] bg-[length:200%_100%] animate-shimmer",
        className,
      )}
    />
  );
}

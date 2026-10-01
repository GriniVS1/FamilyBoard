"use client";

import { useTranslations } from "next-intl";
import { Picto } from "@/components/pictos";
import { cn } from "@/lib/utils";

/** Entry to the points overview; only rendered while parent mode is on. */
export function PointsButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations("points");

  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className={cn(
        "inline-flex h-12 items-center gap-2 rounded-full border-2 border-border bg-surface px-5",
        "kid-label text-ink shadow-pop focus-ring-kid",
        "transition-transform duration-100 ease-snappy active:translate-y-0.5 active:shadow-press",
      )}
    >
      <Picto name="star" size={24} />
      <span>{t("button")}</span>
    </button>
  );
}

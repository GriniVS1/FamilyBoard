"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Picto } from "@/components/pictos";
import { DialogOverlay, DialogPortal } from "@/components/shared/dialog";
import type { NavEntryKey } from "@/components/shared/nav-icons";
import { cn } from "@/lib/utils";
import { NavTile } from "./nav-item";

export type MoreEntry = {
  key: NavEntryKey;
  href: string;
  label: string;
  active: boolean;
};

type MoreSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: MoreEntry[];
  /** Highlights the trigger when the current page lives inside the sheet. */
  activeInside: boolean;
};

export function MoreSheet({ open, onOpenChange, entries, activeInside }: MoreSheetProps) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          aria-haspopup="dialog"
          className={cn(
            "relative flex min-h-16 min-w-16 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 pb-1 pt-1.5",
            "transition-colors duration-kid ease-snappy focus-ring-kid active:scale-[0.96]",
            activeInside && "bg-ink/10 shadow-pop",
          )}
        >
          {activeInside && (
            <span aria-hidden className="absolute inset-x-5 top-0 h-1 rounded-b-full bg-ink" />
          )}
          <Picto name="nav-more" size={32} />
          <span className="whitespace-nowrap text-[13px] font-semibold leading-4 tracking-tight text-ink">
            {t("more")}
          </span>
        </button>
      </DialogPrimitive.Trigger>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-border bg-surface shadow-lift",
            "px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 focus:outline-none",
            "data-[state=open]:animate-slide-up",
          )}
        >
          <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-border" aria-hidden />
          <div className="mb-3 flex items-center justify-between gap-3">
            <DialogPrimitive.Title className="kid-title text-ink">{t("more")}</DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label={tCommon("close")}
              className="inline-flex size-12 items-center justify-center rounded-full text-muted transition-colors hover:bg-ink/5 hover:text-ink focus-ring-kid"
            >
              <X className="size-6" />
            </DialogPrimitive.Close>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {entries.map((entry) => (
              <NavTile
                key={entry.key}
                href={entry.href}
                label={entry.label}
                navKey={entry.key}
                active={entry.active}
                variant="sheet"
                onNavigate={() => onOpenChange(false)}
              />
            ))}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}

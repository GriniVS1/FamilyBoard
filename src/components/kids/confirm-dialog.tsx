"use client";

import { Trash2, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogTitle } from "@/components/shared/dialog";
import { Picto, type PictoName } from "@/components/pictos";
import { cn } from "@/lib/utils";
import { useRestoreFocus } from "./use-restore-focus";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Shows what is affected (e.g. the item's picto) so the choice is visual, not only text. */
  picto?: PictoName;
  preview?: ReactNode;
  /** What is affected in words or numbers, below the title. */
  description?: ReactNode;
  /** Symbol on the preview's corner and on the confirm button; defaults to the bin. */
  icon?: LucideIcon;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
};

/** In-app replacement for window.confirm: big, symbol-led, no browser chrome. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  picto,
  preview,
  description,
  icon: Icon = Trash2,
  confirmLabel,
  onConfirm,
}: ConfirmDialogProps) {
  const tCommon = useTranslations("common");
  const [busy, setBusy] = useState(false);
  const restoreFocus = useRestoreFocus();

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="w-[min(440px,calc(100vw-2rem))]" showClose={false} {...restoreFocus}>
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="relative">
            {picto ? <Picto name={picto} size={88} /> : preview}
            <span
              aria-hidden
              className="absolute -bottom-2 -right-3 inline-flex size-11 items-center justify-center rounded-full border-2 border-surface bg-danger text-surface"
            >
              <Icon className="size-5" strokeWidth={2.5} />
            </span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <DialogTitle className="kid-title">{title}</DialogTitle>
            {description && <div className="kid-body text-muted">{description}</div>}
          </div>
          <div className="grid w-full grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={busy}
              className={cn(
                "inline-flex min-h-14 items-center justify-center rounded-full border-2 border-border bg-surface px-3 py-2",
                "kid-title text-center text-ink shadow-pop focus-ring-kid",
                "transition-transform duration-100 ease-snappy active:translate-y-0.5 active:shadow-press disabled:opacity-50",
              )}
            >
              {tCommon("cancel")}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy}
              className={cn(
                "inline-flex min-h-14 items-center justify-center gap-2 rounded-full border-2 border-danger bg-danger-tint px-3 py-2",
                "kid-title text-center text-danger-ink focus-ring-kid",
                "transition-transform duration-100 ease-snappy active:translate-y-0.5 disabled:opacity-50",
              )}
            >
              <Icon className="size-5 shrink-0" strokeWidth={2.5} aria-hidden />
              {confirmLabel ?? tCommon("delete")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

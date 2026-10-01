"use client";

import { Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogTitle } from "@/components/shared/dialog";
import { Picto, type PictoName } from "@/components/pictos";
import { cn } from "@/lib/utils";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Shows what is affected (e.g. the item's picto) so the choice is visual, not only text. */
  picto?: PictoName;
  preview?: ReactNode;
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
  confirmLabel,
  onConfirm,
}: ConfirmDialogProps) {
  const tCommon = useTranslations("common");
  const [busy, setBusy] = useState(false);

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
      <DialogContent className="w-[min(440px,calc(100vw-2rem))]" showClose={false}>
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="relative">
            {picto ? <Picto name={picto} size={88} /> : preview}
            <span
              aria-hidden
              className="absolute -bottom-2 -right-3 inline-flex size-11 items-center justify-center rounded-full border-2 border-surface bg-danger text-surface"
            >
              <Trash2 className="size-5" strokeWidth={2.5} />
            </span>
          </div>
          <DialogTitle className="kid-title">{title}</DialogTitle>
          <div className="grid w-full grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={busy}
              className={cn(
                "inline-flex h-14 items-center justify-center rounded-full border-2 border-border bg-surface",
                "kid-title text-ink shadow-pop focus-ring-kid",
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
                "inline-flex h-14 items-center justify-center gap-2 rounded-full border-2 border-danger bg-danger-tint",
                "kid-title text-danger-ink focus-ring-kid",
                "transition-transform duration-100 ease-snappy active:translate-y-0.5 disabled:opacity-50",
              )}
            >
              <Trash2 className="size-5" strokeWidth={2.5} aria-hidden />
              {confirmLabel ?? tCommon("delete")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

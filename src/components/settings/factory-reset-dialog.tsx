"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/shared/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/shared/dialog";
import { Input } from "@/components/shared/input";
import { InlineKeyboardPanel } from "@/components/setup/inline-keyboard-panel";
import { postJson } from "@/components/setup/types";

type FactoryResetDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function FactoryResetDialog({
  open,
  onOpenChange,
}: FactoryResetDialogProps) {
  const t = useTranslations("settings.factoryReset");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmFocused, setConfirmFocused] = useState(false);

  function setConfirmUpper(value: string) {
    setConfirm(value.toUpperCase());
  }

  useEffect(() => {
    if (open) {
      setPin("");
      setConfirm("");
      setError(null);
      setConfirmFocused(false);
    }
  }, [open]);

  async function handleReset() {
    if (confirm !== "RESET") {
      setError(t("typeResetError"));
      return;
    }
    if (pin.length !== 6) {
      setError(t("pinRequired"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await postJson<{ ok: true }>("/api/settings/factory-reset", {
        pin,
        confirm: "RESET",
      });
      window.location.href = "/setup";
    } catch (err) {
      setError(err instanceof Error ? err.message : t("resetFailed"));
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3 pr-10">
            <span
              aria-hidden
              className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-rose/30 text-accent-rose"
            >
              <AlertTriangle className="size-6" />
            </span>
            <div>
              <DialogTitle>{t("confirmTitle")}</DialogTitle>
              <p className="mt-1 text-sm text-muted">
                {t("description")}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="reset-pin"
              className="text-xs font-semibold uppercase tracking-wider text-muted"
            >
              {t("adminPin")}
            </label>
            <Input
              id="reset-pin"
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              maxLength={6}
              placeholder="••••"
              className="tabular"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="reset-confirm"
              className="text-xs font-semibold uppercase tracking-wider text-muted"
            >
              {t("typeReset")}
            </label>
            <Input
              id="reset-confirm"
              value={confirm}
              onChange={(e) => setConfirmUpper(e.target.value)}
              onFocus={() => setConfirmFocused(true)}
              onBlur={() => setConfirmFocused(false)}
              placeholder="RESET"
              autoCapitalize="characters"
            />
            <InlineKeyboardPanel
              open={confirmFocused}
              value={confirm}
              onChange={setConfirmUpper}
              showAccents={false}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-accent-rose">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleReset}
              disabled={submitting || confirm !== "RESET" || pin.length !== 6}
              className="bg-accent-rose text-bg hover:bg-accent-rose/90"
            >
              {submitting ? t("resetting") : t("confirm")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/shared/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/shared/dialog";
import { Input } from "@/components/shared/input";
import { postJson } from "@/components/setup/types";

type FactoryResetDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function FactoryResetDialog({
  open,
  onOpenChange,
}: FactoryResetDialogProps) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPin("");
      setConfirm("");
      setError(null);
    }
  }, [open]);

  async function handleReset() {
    if (confirm !== "RESET") {
      setError('Type RESET in capital letters to confirm.');
      return;
    }
    if (pin.length < 4) {
      setError("Enter your admin PIN.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await postJson<{ ok: true }>("/api/settings/factory-reset", {
        pin,
        confirm: "RESET",
      });
      // Hard redirect to setup
      window.location.href = "/setup";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed.");
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
              <DialogTitle>Factory reset</DialogTitle>
              <p className="mt-1 text-sm text-muted">
                Removes all family data — members, events, todos, notes, photos,
                chores. The dashboard returns to the setup wizard.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="reset-pin"
              className="text-xs font-semibold uppercase tracking-wider text-muted"
            >
              Admin PIN
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
              Type RESET to confirm
            </label>
            <Input
              id="reset-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="RESET"
              autoCapitalize="characters"
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
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleReset}
              disabled={submitting || confirm !== "RESET" || pin.length < 4}
              className="bg-accent-rose text-bg hover:bg-accent-rose/90"
            >
              {submitting ? "Resetting…" : "Reset everything"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChefHat } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/shared/dialog";
import { Button } from "@/components/shared/button";
import { cn } from "@/lib/utils";
import type { Recipe } from "../types";

type PickFromRecipeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipes: Recipe[];
  onPick: (recipeId: string, multiplier: number) => Promise<void>;
};

export function PickFromRecipeDialog({
  open,
  onOpenChange,
  recipes,
  onPick,
}: PickFromRecipeDialogProps) {
  const t = useTranslations("meals");
  const tCommon = useTranslations("common");
  const [selected, setSelected] = useState("");
  const [multiplier, setMultiplier] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAdd() {
    if (!selected) return;
    setLoading(true);
    try {
      await onPick(selected, parseFloat(multiplier) || 1);
      onOpenChange(false);
      setSelected("");
      setMultiplier("1");
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon("error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>
          <span className="inline-flex items-center gap-2">
            <ChefHat className="size-5" />
            {t("grocery.addFromRecipe")}
          </span>
        </DialogTitle>

        <div className="mt-6 flex flex-col gap-5">
          <div className="flex flex-col gap-3 max-h-72 overflow-y-auto">
            {recipes.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelected(r.id)}
                className={cn(
                  "tap-target flex items-center gap-3 rounded-2xl border px-4 text-left transition-colors",
                  selected === r.id
                    ? "border-accent-mint bg-accent-mint/20"
                    : "border-border bg-bg hover:bg-surface",
                )}
              >
                <span className="flex-1 text-sm font-medium text-ink">
                  {r.name}
                </span>
                <span className="tabular text-xs text-muted">
                  {r.ingredients.length} ing.
                </span>
              </button>
            ))}
          </div>

          {selected && (
            <div className="flex items-center gap-3">
              <label className="text-sm text-ink shrink-0">Multiplier</label>
              <input
                type="number"
                min={0.5}
                step={0.5}
                value={multiplier}
                onChange={(e) => setMultiplier(e.target.value)}
                className="h-11 w-24 rounded-2xl border border-border bg-surface px-4 text-sm tabular text-ink transition-shadow focus:ring-2 focus:ring-ink/20"
              />
            </div>
          )}

          {error && <p className="text-sm text-accent-rose">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleAdd} disabled={!selected || loading}>
              {loading ? tCommon("saving") : tCommon("add")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

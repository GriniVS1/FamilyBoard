"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/shared/dialog";
import { Button } from "@/components/shared/button";
import { Input } from "@/components/shared/input";
import { cn } from "@/lib/utils";
import type { MealPlan, MealSlot, MealMember, Recipe, MealCreateInput } from "../types";

type MealDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  slot: MealSlot;
  existing?: MealPlan | null;
  recipes: Recipe[];
  members: MealMember[];
  onSave: (input: MealCreateInput) => Promise<void>;
  onDelete?: () => Promise<void>;
};

export function MealDialog({
  open,
  onOpenChange,
  date,
  slot,
  existing,
  recipes,
  members,
  onSave,
  onDelete,
}: MealDialogProps) {
  const t = useTranslations("meals");
  const tCommon = useTranslations("common");

  const [recipeId, setRecipeId] = useState(existing?.recipeId ?? "");
  const [customName, setCustomName] = useState(existing?.customName ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [memberId, setMemberId] = useState(existing?.memberId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setRecipeId(existing?.recipeId ?? "");
      setCustomName(existing?.customName ?? "");
      setNotes(existing?.notes ?? "");
      setMemberId(existing?.memberId ?? "");
      setError("");
    }
  }, [open, existing]);

  async function handleSave() {
    if (!recipeId && !customName.trim()) {
      setError(t("plan.customNameHint"));
      return;
    }
    setSaving(true);
    try {
      await onSave({
        date,
        slot,
        recipeId: recipeId || undefined,
        customName: recipeId ? undefined : customName.trim() || undefined,
        notes: notes.trim() || undefined,
        memberId: memberId || undefined,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon("error"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    setSaving(true);
    try {
      await onDelete();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon("error"));
    } finally {
      setSaving(false);
    }
  }

  const slotLabel = t(`plan.slots.${slot.toLowerCase()}` as Parameters<typeof t>[0]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>
          {existing ? t("plan.edit") : t("plan.addMeal")} — {slotLabel}
        </DialogTitle>

        <div className="mt-6 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-ink">
              {t("plan.recipe")}
            </label>
            <select
              value={recipeId}
              onChange={(e) => {
                setRecipeId(e.target.value);
                if (e.target.value) setCustomName("");
              }}
              className={cn(
                "tap-target w-full rounded-2xl border border-border bg-surface px-4 text-base text-ink",
                "transition-shadow focus:ring-2 focus:ring-ink/20",
              )}
            >
              <option value="">{tCommon("none")}</option>
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {!recipeId && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-ink">
                {t("plan.customName")}
              </label>
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={t("plan.customNameHint")}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-ink">
              {t("plan.member")}
            </label>
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className={cn(
                "tap-target w-full rounded-2xl border border-border bg-surface px-4 text-base text-ink",
                "transition-shadow focus:ring-2 focus:ring-ink/20",
              )}
            >
              <option value="">{tCommon("anyone")}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-ink">
              {t("plan.notes")}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder=""
              className={cn(
                "w-full rounded-2xl border border-border bg-surface px-4 py-3 text-base text-ink placeholder:text-muted",
                "transition-shadow focus:ring-2 focus:ring-ink/20 resize-none",
              )}
            />
          </div>

          {error && (
            <p className="text-sm text-accent-rose">{error}</p>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            {onDelete ? (
              <Button
                variant="ghost"
                onClick={handleDelete}
                disabled={saving}
                className="text-accent-rose hover:text-accent-rose"
              >
                <Trash2 className="size-4" />
                {tCommon("delete")}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                {tCommon("cancel")}
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? tCommon("saving") : tCommon("save")}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

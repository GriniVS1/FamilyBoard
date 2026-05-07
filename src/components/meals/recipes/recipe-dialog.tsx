"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/shared/dialog";
import { Button } from "@/components/shared/button";
import { Input } from "@/components/shared/input";
import { cn } from "@/lib/utils";
import {
  IngredientInputRow,
  type IngredientDraft,
} from "./ingredient-input-row";
import type { Recipe, RecipeCreateInput } from "../types";

type RecipeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe?: Recipe | null;
  onCreate: (input: RecipeCreateInput) => Promise<void>;
  onUpdate: (id: string, input: RecipeCreateInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

function emptyIngredient(): IngredientDraft {
  return { name: "", quantity: "", unit: "" };
}

export function RecipeDialog({
  open,
  onOpenChange,
  recipe,
  onCreate,
  onUpdate,
  onDelete,
}: RecipeDialogProps) {
  const t = useTranslations("meals");
  const tCommon = useTranslations("common");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [servings, setServings] = useState("");
  const [prepMinutes, setPrepMinutes] = useState("");
  const [cookMinutes, setCookMinutes] = useState("");
  const [instructions, setInstructions] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([emptyIngredient()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(recipe?.name ?? "");
      setDescription(recipe?.description ?? "");
      setServings(recipe?.servings?.toString() ?? "");
      setPrepMinutes(recipe?.prepMinutes?.toString() ?? "");
      setCookMinutes(recipe?.cookMinutes?.toString() ?? "");
      setInstructions(recipe?.instructions ?? "");
      setSourceUrl(recipe?.sourceUrl ?? "");
      setImageUrl(recipe?.imageUrl ?? "");
      setTags(recipe?.tags ?? []);
      setIngredients(
        recipe?.ingredients?.length
          ? recipe.ingredients
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((ing) => ({
                name: ing.name,
                quantity: ing.quantity ?? "",
                unit: ing.unit ?? "",
              }))
          : [emptyIngredient()],
      );
      setError("");
    }
  }, [open, recipe]);

  function addTag() {
    const v = tagInput.trim();
    if (v && !tags.includes(v)) setTags((prev) => [...prev, v]);
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  function updateIngredient(index: number, value: IngredientDraft) {
    setIngredients((prev) => prev.map((ing, i) => (i === index ? value : ing)));
  }

  function removeIngredient(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  }

  function addIngredient() {
    setIngredients((prev) => [...prev, emptyIngredient()]);
  }

  function buildInput(): RecipeCreateInput {
    return {
      name: name.trim(),
      description: description.trim() || undefined,
      servings: servings ? parseInt(servings, 10) : undefined,
      prepMinutes: prepMinutes ? parseInt(prepMinutes, 10) : undefined,
      cookMinutes: cookMinutes ? parseInt(cookMinutes, 10) : undefined,
      instructions: instructions.trim() || undefined,
      sourceUrl: sourceUrl.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
      tags,
      ingredients: ingredients
        .filter((ing) => ing.name.trim())
        .map((ing) => ({
          name: ing.name.trim(),
          quantity: ing.quantity.trim() || undefined,
          unit: ing.unit.trim() || undefined,
        })),
    };
  }

  async function handleSave() {
    if (!name.trim()) {
      setError(t("recipe.name") + " " + tCommon("error").toLowerCase());
      return;
    }
    setSaving(true);
    try {
      if (recipe) {
        await onUpdate(recipe.id, buildInput());
      } else {
        await onCreate(buildInput());
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon("error"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!recipe) return;
    if (!window.confirm(t("recipe.deleteConfirm"))) return;
    setSaving(true);
    try {
      await onDelete(recipe.id);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon("error"));
    } finally {
      setSaving(false);
    }
  }

  const isEditing = Boolean(recipe);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh]">
        <DialogTitle>
          {isEditing ? t("recipe.edit") : t("recipe.new")}
        </DialogTitle>

        <div className="mt-6 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-ink">{t("recipe.name")}</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("recipe.name")}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-ink">{t("recipe.description")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={cn(
                "w-full rounded-2xl border border-border bg-surface px-4 py-3 text-base text-ink placeholder:text-muted",
                "transition-shadow focus:ring-2 focus:ring-ink/20 resize-none",
              )}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-ink">{t("recipe.servings")}</label>
              <input
                type="number"
                min={1}
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                className={cn(
                  "h-12 w-full rounded-2xl border border-border bg-surface px-4 text-base text-ink tabular",
                  "transition-shadow focus:ring-2 focus:ring-ink/20",
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-ink">{t("recipe.prepMinutes")}</label>
              <input
                type="number"
                min={0}
                value={prepMinutes}
                onChange={(e) => setPrepMinutes(e.target.value)}
                className={cn(
                  "h-12 w-full rounded-2xl border border-border bg-surface px-4 text-base text-ink tabular",
                  "transition-shadow focus:ring-2 focus:ring-ink/20",
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-ink">{t("recipe.cookMinutes")}</label>
              <input
                type="number"
                min={0}
                value={cookMinutes}
                onChange={(e) => setCookMinutes(e.target.value)}
                className={cn(
                  "h-12 w-full rounded-2xl border border-border bg-surface px-4 text-base text-ink tabular",
                  "transition-shadow focus:ring-2 focus:ring-ink/20",
                )}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-ink">{t("recipe.tags")}</label>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-accent-mint/30 px-3 py-1 text-sm text-ink"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-1 text-muted hover:text-ink"
                    aria-label={`Remove tag ${tag}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder={t("recipe.filterByTag")}
                className={cn(
                  "h-11 flex-1 rounded-2xl border border-border bg-surface px-4 text-sm text-ink placeholder:text-muted",
                  "transition-shadow focus:ring-2 focus:ring-ink/20",
                )}
              />
              <Button variant="secondary" size="icon" onClick={addTag}>
                <Plus className="size-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-ink">{t("recipe.ingredients")}</label>
            {ingredients.map((ing, idx) => (
              <IngredientInputRow
                key={idx}
                index={idx}
                value={ing}
                onChange={updateIngredient}
                onRemove={removeIngredient}
              />
            ))}
            <button
              type="button"
              onClick={addIngredient}
              className="tap-target inline-flex items-center gap-2 rounded-2xl px-3 text-sm text-muted hover:text-ink transition-colors"
            >
              <Plus className="size-4" />
              {t("recipe.addIngredient")}
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-ink">{t("recipe.instructions")}</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
              className={cn(
                "w-full rounded-2xl border border-border bg-surface px-4 py-3 text-base text-ink placeholder:text-muted",
                "transition-shadow focus:ring-2 focus:ring-ink/20 resize-none",
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-ink">{t("recipe.imageUrl")}</label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className={cn(
                  "h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm text-ink placeholder:text-muted",
                  "transition-shadow focus:ring-2 focus:ring-ink/20",
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-ink">{t("recipe.sourceUrl")}</label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className={cn(
                  "h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm text-ink placeholder:text-muted",
                  "transition-shadow focus:ring-2 focus:ring-ink/20",
                )}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-accent-rose">{error}</p>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            {isEditing ? (
              <Button
                variant="ghost"
                onClick={handleDelete}
                disabled={saving}
                className="text-accent-rose hover:text-accent-rose"
              >
                <Trash2 className="size-4" />
                {t("recipe.delete")}
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

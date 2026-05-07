"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type IngredientDraft = {
  name: string;
  quantity: string;
  unit: string;
};

type IngredientInputRowProps = {
  index: number;
  value: IngredientDraft;
  onChange: (index: number, value: IngredientDraft) => void;
  onRemove: (index: number) => void;
};

export function IngredientInputRow({
  index,
  value,
  onChange,
  onRemove,
}: IngredientInputRowProps) {
  const t = useTranslations("meals");

  const field = (key: keyof IngredientDraft, placeholder: string, flex: string) => (
    <input
      value={value[key]}
      onChange={(e) => onChange(index, { ...value, [key]: e.target.value })}
      placeholder={placeholder}
      className={cn(
        "h-11 rounded-xl border border-border bg-surface px-3 text-sm text-ink placeholder:text-muted",
        "transition-shadow focus:ring-2 focus:ring-ink/20",
        flex,
      )}
    />
  );

  return (
    <div className="flex items-center gap-2">
      {field("name", t("recipe.ingredientName"), "flex-1")}
      {field("quantity", t("recipe.quantity"), "w-20")}
      {field("unit", t("recipe.unit"), "w-20")}
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="tap-target inline-flex items-center justify-center rounded-full text-muted hover:text-accent-rose transition-colors"
        aria-label="Remove ingredient"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

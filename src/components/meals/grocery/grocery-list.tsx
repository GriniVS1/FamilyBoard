"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence } from "framer-motion";
import { CalendarDays, ShoppingBasket, ShoppingCart } from "lucide-react";
import { format, startOfWeek } from "date-fns";
import { Button } from "@/components/shared/button";
import { GlassCard } from "@/components/shared/glass-card";
import { cn } from "@/lib/utils";
import { AddGroceryInput } from "./add-grocery-input";
import { GroceryRow } from "./grocery-row";
import { PickFromRecipeDialog } from "./pick-from-recipe-dialog";
import type {
  GroceryItem,
  GroceryCreateInput,
  GroceryPatchInput,
  Recipe,
} from "../types";

type GroceryListProps = {
  items: GroceryItem[];
  recipes: Recipe[];
  onAdd: (input: GroceryCreateInput) => void;
  onToggle: (item: GroceryItem) => void;
  onPatch: (id: string, patch: GroceryPatchInput) => void;
  onDelete: (id: string) => void;
  onClearChecked: () => Promise<void>;
  onAddFromRecipe: (recipeId: string, multiplier: number) => Promise<void>;
  onAddFromWeek: () => Promise<void>;
};

export function GroceryList({
  items,
  recipes,
  onAdd,
  onToggle,
  onPatch,
  onDelete,
  onClearChecked,
  onAddFromRecipe,
  onAddFromWeek,
}: GroceryListProps) {
  const t = useTranslations("meals");
  const [pickRecipeOpen, setPickRecipeOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [weekLoading, setWeekLoading] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }

  async function handleAddFromWeek() {
    setWeekLoading(true);
    try {
      await onAddFromWeek();
      showToast(t("grocery.addedFromWeek"));
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("grocery.addedFromWeek"));
    } finally {
      setWeekLoading(false);
    }
  }

  const grouped = groupByCategory(items);
  const checkedCount = items.filter((i) => i.checked).length;
  const allChecked = items.length > 0 && checkedCount === items.length;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <AddGroceryInput onAdd={onAdd} />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          onClick={() => setPickRecipeOpen(true)}
          className="text-sm"
        >
          <ShoppingBasket className="size-4" />
          {t("grocery.addFromRecipe")}
        </Button>
        <Button
          variant="secondary"
          onClick={handleAddFromWeek}
          disabled={weekLoading}
          className="text-sm"
        >
          <CalendarDays className="size-4" />
          {weekLoading ? t("grocery.addedFromWeek") : t("grocery.addFromWeek")}
        </Button>
        {checkedCount > 0 && (
          <Button
            variant="ghost"
            onClick={async () => {
              await onClearChecked();
            }}
            className="ml-auto text-sm text-muted"
          >
            {t("grocery.clearChecked")}
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <GlassCard className="flex flex-col items-center gap-4 p-10 text-center">
          <span className="inline-flex size-20 items-center justify-center rounded-full bg-accent-mint/30 text-ink">
            <ShoppingCart className="size-9" />
          </span>
          <h3 className="font-display text-2xl tracking-tight text-ink">
            {t("grocery.empty")}
          </h3>
        </GlassCard>
      ) : allChecked ? (
        <GlassCard className="p-6 text-center text-sm text-muted">
          {t("grocery.allChecked")}
        </GlassCard>
      ) : null}

      <div className="flex flex-col gap-4">
        {Object.entries(grouped).map(([category, categoryItems]) => (
          <section key={category}>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              {category
                ? t(`grocery.categories.${category}` as Parameters<typeof t>[0])
                : t("grocery.categories.other")}
            </h3>
            <div className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {categoryItems.map((item) => (
                  <GroceryRow
                    key={item.id}
                    item={item}
                    onToggle={onToggle}
                    onPatch={onPatch}
                    onDelete={onDelete}
                  />
                ))}
              </AnimatePresence>
            </div>
          </section>
        ))}
      </div>

      <PickFromRecipeDialog
        open={pickRecipeOpen}
        onOpenChange={setPickRecipeOpen}
        recipes={recipes}
        onPick={onAddFromRecipe}
      />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink shadow-lift md:bottom-8"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function groupByCategory(
  items: GroceryItem[],
): Record<string, GroceryItem[]> {
  const sorted = [...items].sort((a, b) => {
    if (a.checked !== b.checked) return a.checked ? 1 : -1;
    return a.order - b.order;
  });

  const out: Record<string, GroceryItem[]> = {};
  for (const item of sorted) {
    const cat = item.category ?? "other";
    const bucket = out[cat] ?? [];
    bucket.push(item);
    out[cat] = bucket;
  }
  return out;
}

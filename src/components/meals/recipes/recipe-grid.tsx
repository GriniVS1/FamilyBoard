"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { ChefHat, Plus, Search } from "lucide-react";
import { Button } from "@/components/shared/button";
import { GlassCard } from "@/components/shared/glass-card";
import { RecipeCard } from "./recipe-card";
import { RecipeDialog } from "./recipe-dialog";
import type { Recipe, RecipeCreateInput } from "../types";

type RecipeGridProps = {
  recipes: Recipe[];
  onCreate: (input: RecipeCreateInput) => Promise<void>;
  onUpdate: (id: string, input: RecipeCreateInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddToGrocery: (recipeId: string) => Promise<void>;
};

export function RecipeGrid({
  recipes,
  onCreate,
  onUpdate,
  onDelete,
  onAddToGrocery,
}: RecipeGridProps) {
  const t = useTranslations("meals");
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }

  const allTags = Array.from(
    new Set(recipes.flatMap((r) => r.tags)),
  ).sort();

  const filtered = recipes.filter((r) => {
    const matchSearch =
      !search ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.description ?? "").toLowerCase().includes(search.toLowerCase());
    const matchTag = !tagFilter || r.tags.includes(tagFilter);
    return matchSearch && matchTag;
  });

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(recipe: Recipe) {
    setEditing(recipe);
    setDialogOpen(true);
  }

  async function handleAddToGrocery(recipe: Recipe) {
    try {
      await onAddToGrocery(recipe.id);
      showToast(t("recipe.addedToGrocery"));
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("recipe.addToGrocery"));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("recipe.search")}
            className="h-12 w-full rounded-2xl border border-border bg-surface pl-9 pr-4 text-sm text-ink placeholder:text-muted transition-shadow focus:ring-2 focus:ring-ink/20"
          />
        </div>
        <Button onClick={openNew}>
          <Plus className="size-5" />
          {t("recipe.new")}
        </Button>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTagFilter(null)}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              tagFilter === null
                ? "bg-ink text-bg"
                : "bg-border text-muted hover:text-ink"
            }`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setTagFilter(tag === tagFilter ? null : tag)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                tagFilter === tag
                  ? "bg-accent-mint/60 text-ink"
                  : "bg-accent-mint/20 text-ink hover:bg-accent-mint/40"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <GlassCard className="flex flex-col items-center gap-4 p-10 text-center">
          <span className="inline-flex size-20 items-center justify-center rounded-full bg-accent-peach/30 text-ink">
            <ChefHat className="size-9" />
          </span>
          <h3 className="font-display text-2xl tracking-tight text-ink">
            {t("recipe.empty")}
          </h3>
          <Button onClick={openNew}>
            <Plus className="size-5" />
            {t("recipe.new")}
          </Button>
        </GlassCard>
      ) : (
        <AnimatePresence>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onSelect={openEdit}
                onAddToGrocery={handleAddToGrocery}
              />
            ))}
          </div>
        </AnimatePresence>
      )}

      <RecipeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        recipe={editing}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onDelete={onDelete}
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

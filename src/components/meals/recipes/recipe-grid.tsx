"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { ChefHat, Plus, Search } from "lucide-react";
import { KidToast } from "@/components/kids/kid-toast";
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
  const tKids = useTranslations("kids");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [toast, setToast] = useState<{ tone: "success" | "error"; text: string } | null>(null);

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
      setToast({ tone: "success", text: t("recipe.addedToGrocery") });
    } catch {
      setToast({ tone: "error", text: tKids("errorGeneric") });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("recipe.search")}
            className="h-12 w-full rounded-2xl border border-border bg-surface pl-10 pr-4 text-base text-ink placeholder:text-muted transition-shadow focus:ring-2 focus:ring-ink/20"
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
            className={`kid-label min-h-12 rounded-full px-4 transition-colors focus-ring-kid ${
              tagFilter === null
                ? "bg-ink text-bg"
                : "bg-border text-ink"
            }`}
          >
            {tCommon("all")}
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setTagFilter(tag === tagFilter ? null : tag)}
              className={`kid-label min-h-12 rounded-full px-4 transition-colors focus-ring-kid ${
                tagFilter === tag
                  ? "bg-accent-mint text-on-accent"
                  : "bg-accent-mint-tint text-accent-mint-ink"
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
        <KidToast
          tone={toast.tone}
          picto={toast.tone === "success" ? "shopping" : "oops"}
          durationMs={6000}
          onDismiss={() => setToast(null)}
        >
          {toast.text}
        </KidToast>
      )}
    </div>
  );
}

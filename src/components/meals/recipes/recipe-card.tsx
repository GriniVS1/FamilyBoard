"use client";

import { motion } from "framer-motion";
import { Clock, ShoppingBasket, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { Recipe } from "../types";

type RecipeCardProps = {
  recipe: Recipe;
  onSelect: (recipe: Recipe) => void;
  onAddToGrocery: (recipe: Recipe) => void;
};

export function RecipeCard({ recipe, onSelect, onAddToGrocery }: RecipeCardProps) {
  const t = useTranslations("meals");

  const totalMinutes =
    (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18 }}
      className="card-soft flex flex-col overflow-hidden"
    >
      {recipe.imageUrl && (
        <div className="relative h-36 overflow-hidden bg-bg">
          <img
            src={recipe.imageUrl}
            alt={recipe.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => onSelect(recipe)}
        className="flex-1 px-4 pt-4 pb-2 text-left"
      >
        <h3 className="font-display text-lg tracking-tight text-ink line-clamp-1">
          {recipe.name}
        </h3>
        {recipe.description && (
          <p className="mt-1 text-sm text-muted line-clamp-2">
            {recipe.description}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
          {totalMinutes > 0 && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" />
              <span className="tabular">{totalMinutes} min</span>
            </span>
          )}
          {recipe.servings != null && (
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" />
              <span className="tabular">{recipe.servings}</span>
            </span>
          )}
        </div>

        {recipe.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {recipe.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-accent-sky/20 px-2.5 py-0.5 text-xs text-ink"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </button>

      <div className="px-4 pb-4 pt-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAddToGrocery(recipe);
          }}
          className={cn(
            "tap-target inline-flex w-full items-center justify-center gap-2",
            "rounded-2xl border border-border bg-bg px-4 text-sm font-medium text-ink",
            "hover:bg-surface transition-colors",
          )}
        >
          <ShoppingBasket className="size-4" />
          {t("recipe.addToGrocery")}
        </button>
      </div>
    </motion.div>
  );
}

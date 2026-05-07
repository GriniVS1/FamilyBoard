"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { format, startOfWeek, addWeeks } from "date-fns";
import { cn } from "@/lib/utils";
import { WeekPlan } from "./plan/week-plan";
import { RecipeGrid } from "./recipes/recipe-grid";
import { GroceryList } from "./grocery/grocery-list";
import type {
  MealPlan,
  MealMember,
  Recipe,
  GroceryItem,
  MealCreateInput,
  RecipeCreateInput,
  GroceryCreateInput,
  GroceryPatchInput,
} from "./types";

type Tab = "plan" | "recipes" | "grocery";

type MealsViewProps = {
  initialMembers: MealMember[];
};

const RECIPES_KEY: QueryKey = ["recipes"];
const GROCERY_KEY: QueryKey = ["grocery"];

async function jsonRequest<T>(
  url: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: { message?: string } };
      if (data?.error?.message) message = data.error.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

function buildMealsKey(from: string, to: string): QueryKey {
  return ["meals", from, to];
}

export function MealsView({ initialMembers }: MealsViewProps) {
  const t = useTranslations("meals");
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("plan");
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), {
    weekStartsOn: 1,
  });
  const from = format(weekStart, "yyyy-MM-dd");
  const to = format(addWeeks(weekStart, 1), "yyyy-MM-dd");
  const mealsKey = buildMealsKey(from, to);

  const { data: meals = [] } = useQuery<MealPlan[]>({
    queryKey: mealsKey,
    queryFn: () =>
      jsonRequest<MealPlan[]>(`/api/meals?from=${from}&to=${to}`, "GET"),
  });

  const { data: recipes = [] } = useQuery<Recipe[]>({
    queryKey: RECIPES_KEY,
    queryFn: () => jsonRequest<Recipe[]>("/api/recipes", "GET"),
  });

  const { data: groceryItems = [] } = useQuery<GroceryItem[]>({
    queryKey: GROCERY_KEY,
    queryFn: () => jsonRequest<GroceryItem[]>("/api/grocery", "GET"),
  });

  const saveMealMutation = useMutation({
    mutationFn: (input: MealCreateInput) =>
      jsonRequest<MealPlan>("/api/meals", "POST", input),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["meals"] });
    },
  });

  const deleteMealMutation = useMutation({
    mutationFn: (id: string) =>
      jsonRequest<{ ok: true }>(`/api/meals/${id}`, "DELETE"),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["meals"] });
    },
  });

  const createRecipeMutation = useMutation({
    mutationFn: (input: RecipeCreateInput) =>
      jsonRequest<Recipe>("/api/recipes", "POST", input),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: RECIPES_KEY });
    },
  });

  const updateRecipeMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: RecipeCreateInput }) =>
      jsonRequest<Recipe>(`/api/recipes/${id}`, "PATCH", input),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: RECIPES_KEY });
    },
  });

  const deleteRecipeMutation = useMutation({
    mutationFn: (id: string) =>
      jsonRequest<{ ok: true }>(`/api/recipes/${id}`, "DELETE"),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: RECIPES_KEY });
    },
  });

  const addGroceryMutation = useMutation({
    mutationFn: (input: GroceryCreateInput) =>
      jsonRequest<GroceryItem>("/api/grocery", "POST", input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: GROCERY_KEY });
      const previous = queryClient.getQueryData<GroceryItem[]>(GROCERY_KEY) ?? [];
      const optimistic: GroceryItem = {
        id: `temp-${Date.now()}`,
        name: input.name,
        quantity: input.quantity ?? null,
        unit: input.unit ?? null,
        category: input.category ?? null,
        checked: false,
        source: null,
        order: previous.length,
      };
      queryClient.setQueryData<GroceryItem[]>(GROCERY_KEY, [
        ...previous,
        optimistic,
      ]);
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(GROCERY_KEY, ctx.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: GROCERY_KEY });
    },
  });

  const patchGroceryMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: GroceryPatchInput }) =>
      jsonRequest<GroceryItem>(`/api/grocery/${id}`, "PATCH", patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: GROCERY_KEY });
      const previous = queryClient.getQueryData<GroceryItem[]>(GROCERY_KEY) ?? [];
      queryClient.setQueryData<GroceryItem[]>(
        GROCERY_KEY,
        previous.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
      return { previous };
    },
    onError: (_err, _args, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(GROCERY_KEY, ctx.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: GROCERY_KEY });
    },
  });

  const deleteGroceryMutation = useMutation({
    mutationFn: (id: string) =>
      jsonRequest<{ ok: true }>(`/api/grocery/${id}`, "DELETE"),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: GROCERY_KEY });
      const previous = queryClient.getQueryData<GroceryItem[]>(GROCERY_KEY) ?? [];
      queryClient.setQueryData<GroceryItem[]>(
        GROCERY_KEY,
        previous.filter((item) => item.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(GROCERY_KEY, ctx.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: GROCERY_KEY });
    },
  });

  const clearCheckedMutation = useMutation({
    mutationFn: () =>
      jsonRequest<{ ok: true }>("/api/grocery/clear-checked", "POST"),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: GROCERY_KEY });
    },
  });

  const addFromRecipeMutation = useMutation({
    mutationFn: ({
      recipeId,
      multiplier,
    }: {
      recipeId: string;
      multiplier: number;
    }) =>
      jsonRequest<GroceryItem[]>("/api/grocery/from-recipe", "POST", {
        recipeId,
        multiplier,
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: GROCERY_KEY });
    },
  });

  const addFromWeekMutation = useMutation({
    mutationFn: () =>
      jsonRequest<GroceryItem[]>("/api/grocery/from-week", "POST", {
        startDate: from,
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: GROCERY_KEY });
    },
  });

  const TABS: { key: Tab; label: string }[] = [
    { key: "plan", label: t("tabs.plan") },
    { key: "recipes", label: t("tabs.recipes") },
    { key: "grocery", label: t("tabs.grocery") },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl tracking-tight text-ink sm:text-3xl">
          {t("title")}
        </h2>
      </div>

      <div className="flex rounded-2xl border border-border bg-bg p-1 gap-1 w-fit">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "tap-target px-5 rounded-xl text-sm font-medium transition-colors",
              tab === key
                ? "bg-surface text-ink shadow-sm"
                : "text-muted hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "plan" && (
        <WeekPlan
          meals={meals}
          recipes={recipes}
          members={initialMembers}
          weekOffset={weekOffset}
          onWeekOffsetChange={setWeekOffset}
          onSave={async (input) => {
            await saveMealMutation.mutateAsync(input);
          }}
          onDelete={async (id) => {
            await deleteMealMutation.mutateAsync(id);
          }}
        />
      )}

      {tab === "recipes" && (
        <RecipeGrid
          recipes={recipes}
          onCreate={async (input) => {
            await createRecipeMutation.mutateAsync(input);
          }}
          onUpdate={async (id, input) => {
            await updateRecipeMutation.mutateAsync({ id, input });
          }}
          onDelete={async (id) => {
            await deleteRecipeMutation.mutateAsync(id);
          }}
          onAddToGrocery={async (recipeId) => {
            await addFromRecipeMutation.mutateAsync({
              recipeId,
              multiplier: 1,
            });
          }}
        />
      )}

      {tab === "grocery" && (
        <GroceryList
          items={groceryItems}
          recipes={recipes}
          onAdd={(input) => {
            addGroceryMutation.mutate(input);
          }}
          onToggle={(item) => {
            patchGroceryMutation.mutate({
              id: item.id,
              patch: { checked: !item.checked },
            });
          }}
          onPatch={(id, patch) => {
            patchGroceryMutation.mutate({ id, patch });
          }}
          onDelete={(id) => {
            deleteGroceryMutation.mutate(id);
          }}
          onClearChecked={async () => {
            await clearCheckedMutation.mutateAsync();
          }}
          onAddFromRecipe={async (recipeId, multiplier) => {
            await addFromRecipeMutation.mutateAsync({ recipeId, multiplier });
          }}
          onAddFromWeek={async () => {
            await addFromWeekMutation.mutateAsync();
          }}
        />
      )}
    </div>
  );
}

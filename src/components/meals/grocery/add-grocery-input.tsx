"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { InlineKeyboardPanel } from "@/components/setup/inline-keyboard-panel";
import { useOskField } from "@/hooks/use-osk-field";
import { cn } from "@/lib/utils";
import type { GroceryCreateInput } from "../types";

type AddGroceryInputProps = {
  onAdd: (input: GroceryCreateInput) => void;
};

export function AddGroceryInput({ onAdd }: AddGroceryInputProps) {
  const t = useTranslations("meals");
  const [value, setValue] = useState("");
  const { activeField, bind } = useOskField<"item">();

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    const parts = trimmed.split(" ");
    const maybeQty = parts.length > 1 ? parts[0] : undefined;
    const isNumeric = maybeQty && /^\d+([.,]\d+)?$/.test(maybeQty);

    onAdd({
      name: isNumeric ? parts.slice(1).join(" ") : trimmed,
      quantity: isNumeric ? maybeQty : undefined,
    });
    setValue("");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          placeholder={t("grocery.addPlaceholder")}
          className={cn(
            "h-14 flex-1 rounded-2xl border border-border bg-surface px-5 text-base text-ink placeholder:text-muted",
            "transition-colors focus:border-focus",
          )}
          {...bind("item")}
        />
        <button
          type="button"
          onClick={handleSubmit}
          className={cn(
            "inline-flex size-14 shrink-0 items-center justify-center rounded-full",
            "bg-accent-sky text-on-accent shadow-pop transition-colors focus-ring-kid active:shadow-press",
          )}
          aria-label={t("grocery.addPlaceholder")}
        >
          <Plus className="size-6" strokeWidth={2.75} />
        </button>
      </div>
      <InlineKeyboardPanel
        open={activeField === "item"}
        value={value}
        onChange={setValue}
      />
    </div>
  );
}

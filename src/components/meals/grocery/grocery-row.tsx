"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { InlineKeyboardPanel } from "@/components/setup/inline-keyboard-panel";
import { useOskField } from "@/hooks/use-osk-field";
import { cn } from "@/lib/utils";
import type { GroceryItem, GroceryPatchInput } from "../types";

type GroceryEditField = "name" | "quantity" | "unit";

type GroceryRowProps = {
  item: GroceryItem;
  onToggle: (item: GroceryItem) => void;
  onPatch: (id: string, patch: GroceryPatchInput) => void;
  onDelete: (id: string) => void;
};

export function GroceryRow({ item, onToggle, onPatch, onDelete }: GroceryRowProps) {
  const t = useTranslations("meals");
  const tCommon = useTranslations("common");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editQty, setEditQty] = useState(item.quantity ?? "");
  const [editUnit, setEditUnit] = useState(item.unit ?? "");
  const { activeField, bind } = useOskField<GroceryEditField>();

  function commitEdit() {
    if (editName.trim() && editName.trim() !== item.name) {
      onPatch(item.id, {
        name: editName.trim(),
        quantity: editQty.trim() || undefined,
        unit: editUnit.trim() || undefined,
      });
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <motion.div layout className="flex flex-col gap-2">
        <div className="flex items-center gap-2 rounded-2xl border border-accent-sky/40 bg-surface px-4 py-2">
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") setEditing(false);
            }}
            className="flex-1 bg-transparent text-base text-ink"
            {...bind("name")}
          />
          <input
            value={editQty}
            onChange={(e) => setEditQty(e.target.value)}
            placeholder={t("recipe.quantity")}
            className="w-20 bg-transparent text-base text-muted tabular text-right"
            {...bind("quantity")}
          />
          <input
            value={editUnit}
            onChange={(e) => setEditUnit(e.target.value)}
            placeholder={t("recipe.unit")}
            className="w-20 bg-transparent text-base text-muted text-right"
            {...bind("unit")}
          />
          <button
            type="button"
            onClick={commitEdit}
            aria-label={tCommon("save")}
            className="tap-target inline-flex items-center justify-center rounded-full text-ink transition-colors focus-ring-kid"
          >
            <Check className="size-5" />
          </button>
        </div>
        <InlineKeyboardPanel
          open={activeField === "name"}
          value={editName}
          onChange={setEditName}
        />
        <InlineKeyboardPanel
          open={activeField === "quantity"}
          value={editQty}
          onChange={setEditQty}
          showAccents={false}
        />
        <InlineKeyboardPanel
          open={activeField === "unit"}
          value={editUnit}
          onChange={setEditUnit}
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 4 }}
      transition={{ duration: 0.18 }}
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-border px-4 py-3",
        item.checked ? "bg-bg opacity-60" : "bg-surface",
      )}
    >
      <CheckButton
        checked={item.checked}
        onToggle={() => onToggle(item)}
        label={item.checked ? t("grocery.uncheck") : t("grocery.check")}
      />

      <button
        type="button"
        onDoubleClick={() => setEditing(true)}
        onClick={() => setEditing(true)}
        className="flex min-h-12 flex-1 items-center gap-2 rounded-xl text-left focus-ring-kid"
        aria-label={t("grocery.editItem", { name: item.name })}
      >
        <span
          className={cn(
            "kid-body",
            item.checked ? "line-through text-muted" : "text-ink",
          )}
        >
          {item.name}
        </span>
        {(item.quantity || item.unit) && (
          <span className="tabular text-sm text-muted">
            {item.quantity} {item.unit}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => onDelete(item.id)}
        className="tap-target inline-flex items-center justify-center rounded-full bg-danger-tint text-danger-ink transition-colors focus-ring-kid"
        aria-label={t("grocery.deleteItem", { name: item.name })}
      >
        <Trash2 className="size-5" />
      </button>
    </motion.div>
  );
}

function CheckButton({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      whileTap={{ scale: 0.85 }}
      transition={{ type: "spring", stiffness: 500, damping: 25 }}
      className="tap-target inline-flex shrink-0 items-center justify-center rounded-full focus-ring-kid"
      aria-label={label}
      aria-pressed={checked}
    >
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-full border-[3px] transition-colors duration-kid",
          checked
            ? "border-accent-mint bg-accent-mint text-on-accent"
            : "border-muted bg-surface text-transparent",
        )}
      >
      <AnimatePresence>
        {checked && (
          <motion.span
            key="check"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 600, damping: 20 }}
          >
            <Check className="size-5" strokeWidth={3.5} />
          </motion.span>
        )}
      </AnimatePresence>
      </span>
    </motion.button>
  );
}

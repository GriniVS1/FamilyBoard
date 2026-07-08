"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Trash2 } from "lucide-react";
import { useState } from "react";
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
            className="flex-1 bg-transparent text-sm text-ink focus:outline-none"
            {...bind("name")}
          />
          <input
            value={editQty}
            onChange={(e) => setEditQty(e.target.value)}
            placeholder="qty"
            className="w-14 bg-transparent text-sm text-muted focus:outline-none tabular text-right"
            {...bind("quantity")}
          />
          <input
            value={editUnit}
            onChange={(e) => setEditUnit(e.target.value)}
            placeholder="unit"
            className="w-14 bg-transparent text-sm text-muted focus:outline-none text-right"
            {...bind("unit")}
          />
          <button
            type="button"
            onClick={commitEdit}
            className="tap-target inline-flex items-center justify-center rounded-full text-muted hover:text-ink transition-colors"
          >
            <Check className="size-4" />
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
      <CheckButton checked={item.checked} onToggle={() => onToggle(item)} />

      <button
        type="button"
        onDoubleClick={() => setEditing(true)}
        onClick={() => setEditing(true)}
        className="flex-1 flex items-center gap-2 text-left min-h-12"
        aria-label={`Edit ${item.name}`}
      >
        <span
          className={cn(
            "text-sm font-medium",
            item.checked ? "line-through text-muted" : "text-ink",
          )}
        >
          {item.name}
        </span>
        {(item.quantity || item.unit) && (
          <span className="tabular text-xs text-muted">
            {item.quantity} {item.unit}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => onDelete(item.id)}
        className="tap-target inline-flex items-center justify-center rounded-full text-muted hover:text-accent-rose transition-colors"
        aria-label={`Delete ${item.name}`}
      >
        <Trash2 className="size-4" />
      </button>
    </motion.div>
  );
}

function CheckButton({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      whileTap={{ scale: 0.85 }}
      transition={{ type: "spring", stiffness: 500, damping: 25 }}
      className={cn(
        "size-6 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors",
        checked
          ? "border-accent-mint bg-accent-mint/80 text-bg"
          : "border-border bg-surface text-transparent hover:border-accent-mint/60",
      )}
      aria-label={checked ? "Uncheck" : "Check"}
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
            <Check className="size-3.5" strokeWidth={3} />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

"use client";

import { useTranslations } from "next-intl";
import type { ChoreMember, PointResetRecord } from "@/components/chores/types";
import { KidToast } from "@/components/kids/kid-toast";
import type { PointsToastState } from "./use-points";

const UNDO_MS = 8000;
const ERROR_MS = 15_000;

type PointsToastProps = {
  toast: PointsToastState;
  members: readonly ChoreMember[];
  centerOn?: string;
  onUndo: (resets: PointResetRecord[]) => void;
  onRetry: (retry: Extract<PointsToastState, { kind: "error" }>["retry"]) => void;
  onDismiss: () => void;
};

export function PointsToast({ toast, members, centerOn, onUndo, onRetry, onDismiss }: PointsToastProps) {
  const t = useTranslations("points");
  const tKids = useTranslations("kids");

  if (toast.kind === "error") {
    return (
      <KidToast
        key={toast.id}
        tone="error"
        picto="oops"
        action={{ kind: "retry", onClick: () => onRetry(toast.retry) }}
        durationMs={ERROR_MS}
        centerOn={centerOn}
        onDismiss={onDismiss}
      >
        {toast.failure === "offline" ? tKids("offline") : tKids("errorGeneric")}
      </KidToast>
    );
  }

  const [first] = toast.resets;
  const single = toast.resets.length === 1 ? first : undefined;
  const member = single ? members.find((m) => m.id === single.memberId) : undefined;
  const name = member?.name ?? "";

  return (
    <KidToast
      key={toast.id}
      tone="success"
      picto="star"
      action={{
        kind: "undo",
        onClick: () => onUndo(toast.resets),
        color: member?.color,
        label: single ? t("toast.undoOne", { name }) : t("toast.undoMany"),
      }}
      durationMs={UNDO_MS}
      centerOn={centerOn}
      onDismiss={onDismiss}
    >
      <span className="line-clamp-2 break-words">
        {single
          ? t("toast.one", { name, count: single.points })
          : t("toast.many", { count: toast.resets.length })}
      </span>
    </KidToast>
  );
}

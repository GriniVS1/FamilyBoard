"use client";

import { useState } from "react";

type Side = "first" | "second";

type LiftState = { first: boolean; second: boolean; lifted: Side | null };

/**
 * Two toasts can be up at once. The one that came first keeps the bottom place
 * and the newcomer sits above it, so nothing moves under a finger. When the
 * lower one ends, the upper one stays where it is until it ends too.
 */
export function useToastLift(first: boolean, second: boolean): { first: boolean; second: boolean } {
  const [prev, setPrev] = useState<LiftState>({ first: false, second: false, lifted: null });

  let lifted = prev.lifted;
  if ((lifted === "first" && !first) || (lifted === "second" && !second)) lifted = null;
  if (first && second && lifted === null) {
    lifted = first && !prev.first ? "first" : "second";
  }

  if (prev.first !== first || prev.second !== second || prev.lifted !== lifted) {
    setPrev({ first, second, lifted });
  }

  return { first: lifted === "first", second: lifted === "second" };
}

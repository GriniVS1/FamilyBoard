import { resolveTaskPicto, type PictoName } from "@/components/pictos";

/** One place that decides which motif a chore shows; cards, dialogs and toasts all go through it. */
export function taskPictoOf(icon: string | null, title: string): PictoName | null {
  return resolveTaskPicto(icon, title);
}

import {
  Calendar,
  ChefHat,
  Image as ImageIcon,
  ListTodo,
  Star,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import type { NavKey } from "@/lib/nav-config";

// Shared between the shell (rendering) and the settings nav-config card (the
// "which icon goes with this feature" picker), so they can never drift.
export const NAV_ICON: Record<NavKey, LucideIcon> = {
  calendar: Calendar,
  meals: ChefHat,
  chores: Star,
  todos: ListTodo,
  notes: StickyNote,
  photos: ImageIcon,
};

export const NAV_HREF: Record<NavKey, string> = {
  calendar: "/calendar",
  meals: "/meals",
  chores: "/chores",
  todos: "/todos",
  notes: "/notes",
  photos: "/photos",
};

export type MealSlot = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";

export type RecipeIngredient = {
  id: string;
  name: string;
  quantity?: string | null;
  unit?: string | null;
  order: number;
};

export type Recipe = {
  id: string;
  name: string;
  description?: string | null;
  servings?: number | null;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  instructions?: string | null;
  sourceUrl?: string | null;
  imageUrl?: string | null;
  tags: string[];
  ingredients: RecipeIngredient[];
};

export type RecipeRef = {
  id: string;
  name: string;
  imageUrl?: string | null;
};

export type MealMemberRef = {
  id: string;
  name: string;
  color: string;
};

export type MealPlan = {
  id: string;
  date: string;
  slot: MealSlot;
  recipeId?: string | null;
  recipe?: RecipeRef | null;
  customName?: string | null;
  notes?: string | null;
  memberId?: string | null;
  member?: MealMemberRef | null;
};

export type GroceryItem = {
  id: string;
  name: string;
  quantity?: string | null;
  unit?: string | null;
  category?: string | null;
  checked: boolean;
  source?: string | null;
  order: number;
};

export type RecipeCreateInput = {
  name: string;
  description?: string;
  servings?: number;
  prepMinutes?: number;
  cookMinutes?: number;
  instructions?: string;
  sourceUrl?: string;
  imageUrl?: string;
  tags?: string[];
  ingredients?: { name: string; quantity?: string; unit?: string }[];
};

export type RecipePatchInput = Partial<RecipeCreateInput>;

export type MealCreateInput = {
  date: string;
  slot: MealSlot;
  recipeId?: string;
  customName?: string;
  notes?: string;
  memberId?: string;
};

export type MealPatchInput = Partial<MealCreateInput>;

export type GroceryCreateInput = {
  name: string;
  quantity?: string;
  unit?: string;
  category?: string;
};

export type GroceryPatchInput = Partial<GroceryCreateInput & { checked: boolean }>;

export type MealMember = {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
};

export const MEAL_SLOTS: MealSlot[] = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];

export const GROCERY_CATEGORIES = [
  "produce",
  "dairy",
  "pantry",
  "frozen",
  "bakery",
  "meat",
  "drinks",
  "other",
] as const;

export type GroceryCategory = (typeof GROCERY_CATEGORIES)[number];

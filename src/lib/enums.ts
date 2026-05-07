export const LICENSE_STATUS = ["UNLICENSED", "TRIAL", "ACTIVE", "EXPIRED"] as const;
export type LicenseStatus = (typeof LICENSE_STATUS)[number];

export const MEMBER_ROLE = ["ADMIN", "MEMBER"] as const;
export type MemberRole = (typeof MEMBER_ROLE)[number];

export const EVENT_SOURCE = ["LOCAL", "GOOGLE"] as const;
export type EventSource = (typeof EVENT_SOURCE)[number];

export const MEAL_SLOTS = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

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

export function isLicenseStatus(v: string): v is LicenseStatus {
  return (LICENSE_STATUS as readonly string[]).includes(v);
}

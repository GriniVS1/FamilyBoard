import type { MemberColor } from "@/lib/utils";

export type ChoreMember = {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
  role: string;
};

export type Chore = {
  id: string;
  familyId: string;
  memberId: string | null;
  title: string;
  icon: string | null;
  points: number;
  rrule: string | null;
  createdAt: string;
};

export type WeeklyTotals = {
  points: number;
  completions: number;
};

export type ChoresPayload = {
  chores: Chore[];
  weekStart: string;
  weekEnd: string;
  weeklyByMember: Record<string, WeeklyTotals>;
  weeklyByChore: Record<string, WeeklyTotals>;
};

export type ChoreCompletionResponse = {
  completion: {
    id: string;
    choreId: string;
    memberId: string;
    completedAt: string;
  };
  weeklyPoints: number;
  weeklyCompletions: number;
};

export type ChoreInput = {
  memberId: string | null;
  title: string;
  icon: string | null;
  points: number;
  rrule: string | null;
};

export const CHORE_ICONS = [
  "🧹",
  "🧺",
  "🍽️",
  "🚮",
  "🐶",
  "🚿",
  "📚",
  "🛏️",
  "🌱",
  "🧴",
  "🧊",
  "🧽",
] as const;

export const TINT_BG: Record<MemberColor, string> = {
  peach: "bg-accent-peach/30",
  mint: "bg-accent-mint/30",
  sun: "bg-accent-sun/30",
  sky: "bg-accent-sky/30",
  lilac: "bg-accent-lilac/30",
  rose: "bg-accent-rose/30",
  teal: "bg-accent-teal/30",
  sand: "bg-accent-sand/30",
};

export const TINT_BG_STRONG: Record<MemberColor, string> = {
  peach: "bg-accent-peach/50",
  mint: "bg-accent-mint/50",
  sun: "bg-accent-sun/50",
  sky: "bg-accent-sky/50",
  lilac: "bg-accent-lilac/50",
  rose: "bg-accent-rose/50",
  teal: "bg-accent-teal/50",
  sand: "bg-accent-sand/50",
};

export const TINT_BAR: Record<MemberColor, string> = {
  peach: "bg-accent-peach",
  mint: "bg-accent-mint",
  sun: "bg-accent-sun",
  sky: "bg-accent-sky",
  lilac: "bg-accent-lilac",
  rose: "bg-accent-rose",
  teal: "bg-accent-teal",
  sand: "bg-accent-sand",
};

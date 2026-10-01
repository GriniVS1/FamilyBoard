import type { ChoreTimeOfDay } from "@/lib/enums";

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
  timeOfDay: ChoreTimeOfDay | null;
  createdAt: string;
};

export type WeeklyTotals = {
  points: number;
  completions: number;
};

export type ChoreCompletionToday = {
  id: string;
  choreId: string;
  memberId: string;
  completedAt: string;
};

export type ChoresPayload = {
  chores: Chore[];
  weekStart: string;
  weekEnd: string;
  weeklyByMember: Record<string, WeeklyTotals>;
  weeklyByChore: Record<string, WeeklyTotals>;
  completionsToday: ChoreCompletionToday[];
  today: { start: string; end: string };
  /** Points collected since the member's last reset (or ever). Members without points are omitted. */
  balanceByMember: Record<string, MemberBalance>;
};

export type MemberBalance = {
  balance: number;
  /** ISO time of the last reset, null if never reset. */
  since: string | null;
};

export type PointResetRecord = {
  id: string;
  memberId: string;
  /** Balance that was cleared by this reset. */
  points: number;
  resetAt: string;
};

export type MemberPoints = MemberBalance & {
  memberId: string;
  weekly: number;
  allTime: number;
  /** Newest first, at most 10. */
  history: Omit<PointResetRecord, "memberId">[];
};

export type PointsOverview = {
  members: MemberPoints[];
};

export type PointResetResponse = {
  resets: PointResetRecord[];
};

export type PointResetUndoResponse = {
  ok: true;
  memberId: string;
  balance: number;
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
  timeOfDay?: ChoreTimeOfDay | null;
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

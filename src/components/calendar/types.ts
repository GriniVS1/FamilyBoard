import type { MemberColor } from "@/lib/utils";

export type CalendarEvent = {
  id: string;
  familyId: string;
  memberId: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  source: "LOCAL" | "GOOGLE";
  googleEventId: string | null;
  googleCalendarId: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CalendarMember = {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
  role: string;
};

export type CalendarView = "day" | "week" | "month";

export type EventCreateInput = {
  memberId: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: string;
  endsAt: string;
  allDay?: boolean;
  color?: string | null;
};

export type EventUpdateInput = Partial<EventCreateInput>;

export const COLOR_TINT: Record<MemberColor, string> = {
  peach: "bg-accent-peach/30",
  mint: "bg-accent-mint/30",
  sun: "bg-accent-sun/30",
  sky: "bg-accent-sky/30",
  lilac: "bg-accent-lilac/30",
  rose: "bg-accent-rose/30",
  teal: "bg-accent-teal/30",
  sand: "bg-accent-sand/30",
};

export const COLOR_TINT_STRONG: Record<MemberColor, string> = {
  peach: "bg-accent-peach/50",
  mint: "bg-accent-mint/50",
  sun: "bg-accent-sun/50",
  sky: "bg-accent-sky/50",
  lilac: "bg-accent-lilac/50",
  rose: "bg-accent-rose/50",
  teal: "bg-accent-teal/50",
  sand: "bg-accent-sand/50",
};

export const COLOR_BORDER: Record<MemberColor, string> = {
  peach: "border-accent-peach",
  mint: "border-accent-mint",
  sun: "border-accent-sun",
  sky: "border-accent-sky",
  lilac: "border-accent-lilac",
  rose: "border-accent-rose",
  teal: "border-accent-teal",
  sand: "border-accent-sand",
};

export const COLOR_DOT: Record<MemberColor, string> = {
  peach: "bg-accent-peach",
  mint: "bg-accent-mint",
  sun: "bg-accent-sun",
  sky: "bg-accent-sky",
  lilac: "bg-accent-lilac",
  rose: "bg-accent-rose",
  teal: "bg-accent-teal",
  sand: "bg-accent-sand",
};

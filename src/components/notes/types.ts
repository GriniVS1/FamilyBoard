import type { MemberColor } from "@/lib/utils";

export type NoteMember = {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
  role: string;
};

export type Note = {
  id: string;
  familyId: string;
  authorMemberId: string | null;
  body: string;
  color: string;
  pinned: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type NoteCreateInput = {
  body: string;
  color: MemberColor;
  authorMemberId?: string | null;
  pinned?: boolean;
};

export type NotePatchInput = Partial<{
  body: string;
  color: string;
  authorMemberId: string | null;
  pinned: boolean;
}>;

export const NOTE_TINT: Record<MemberColor, string> = {
  peach: "bg-accent-peach/40",
  mint: "bg-accent-mint/40",
  sun: "bg-accent-sun/40",
  sky: "bg-accent-sky/40",
  lilac: "bg-accent-lilac/40",
  rose: "bg-accent-rose/40",
  teal: "bg-accent-teal/40",
  sand: "bg-accent-sand/40",
};

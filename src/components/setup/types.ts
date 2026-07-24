import type { MemberColor } from "@/lib/utils";

export type SetupStatus = {
  installationId: string;
  localeChosen: boolean;
  familyCreated: boolean;
  memberCount: number;
  pinSet: boolean;
  weatherSet: boolean;
  googleConfigured: boolean;
  setupComplete: boolean;
};

export type ApiError = {
  error: { code: string; message: string };
};

export type DraftMember = {
  id: string;
  name: string;
  color: MemberColor;
  emoji: string;
  role: "ADMIN" | "MEMBER";
};

export type StepKey =
  | "language"
  | "network"
  | "app"
  | "welcome"
  | "family"
  | "members"
  | "pin"
  | "weather"
  | "done";

export const MEMBER_EMOJIS = [
  "👩",
  "👨",
  "👧",
  "👦",
  "🧑",
  "👵",
  "👴",
  "🐶",
  "🐱",
  "🦊",
  "🐻",
  "🦁",
] as const;

export async function postJson<T>(
  url: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as ApiError;
      if (data?.error?.message) message = data.error.message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

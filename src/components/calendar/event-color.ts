import { isMemberColor, type MemberColor } from "@/lib/utils";

export function resolveEventColor(
  event: { color: string | null },
  member?: { color: string } | null,
): MemberColor {
  const candidate = event.color ?? member?.color ?? "sand";
  return isMemberColor(candidate) ? candidate : "sand";
}

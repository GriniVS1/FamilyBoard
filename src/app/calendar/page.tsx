import { AppShell } from "@/components/shell/app-shell";
import { CalendarView } from "@/components/calendar/calendar-view";
import { listMembers } from "@/lib/queries";
import type { CalendarMember } from "@/components/calendar/types";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const members = await listMembers();
  const initialMembers: CalendarMember[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    color: m.color,
    emoji: m.emoji,
    role: m.role,
  }));

  return (
    <AppShell>
      <CalendarView initialMembers={initialMembers} />
    </AppShell>
  );
}

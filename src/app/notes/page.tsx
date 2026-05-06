import { AppShell } from "@/components/shell/app-shell";
import { NotesView } from "@/components/notes/notes-view";
import type { NoteMember } from "@/components/notes/types";
import { listMembers } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const members = await listMembers();
  const initialMembers: NoteMember[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    color: m.color,
    emoji: m.emoji,
    role: m.role,
  }));

  return (
    <AppShell>
      <NotesView initialMembers={initialMembers} />
    </AppShell>
  );
}

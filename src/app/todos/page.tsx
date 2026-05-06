import { AppShell } from "@/components/shell/app-shell";
import { TodosView } from "@/components/todos/todos-view";
import type { TodoMember } from "@/components/todos/types";
import { listMembers } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function TodosPage() {
  const members = await listMembers();
  const initialMembers: TodoMember[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    color: m.color,
    emoji: m.emoji,
    role: m.role,
  }));

  return (
    <AppShell>
      <TodosView initialMembers={initialMembers} />
    </AppShell>
  );
}

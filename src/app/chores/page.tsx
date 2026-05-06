import { AppShell } from "@/components/shell/app-shell";
import { ChoresView } from "@/components/chores/chores-view";
import { listMembers } from "@/lib/queries";
import type { ChoreMember } from "@/components/chores/types";

export const dynamic = "force-dynamic";

export default async function ChoresPage() {
  const members = await listMembers();
  const initialMembers: ChoreMember[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    color: m.color,
    emoji: m.emoji,
    role: m.role,
  }));

  return (
    <AppShell>
      <ChoresView initialMembers={initialMembers} />
    </AppShell>
  );
}

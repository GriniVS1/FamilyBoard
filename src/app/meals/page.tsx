import { AppShell } from "@/components/shell/app-shell";
import { MealsView } from "@/components/meals/meals-view";
import { listMembers } from "@/lib/queries";
import type { MealMember } from "@/components/meals/types";

export const dynamic = "force-dynamic";

export default async function MealsPage() {
  const members = await listMembers();
  const initialMembers: MealMember[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    color: m.color,
    emoji: m.emoji,
  }));

  return (
    <AppShell>
      <MealsView initialMembers={initialMembers} />
    </AppShell>
  );
}

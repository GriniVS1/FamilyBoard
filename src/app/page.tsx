import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { WidgetClock } from "@/components/dashboard/widget-clock";
import { WidgetWeather } from "@/components/dashboard/widget-weather";
import { WidgetToday } from "@/components/dashboard/widget-today";
import { WidgetChores } from "@/components/dashboard/widget-chores";
import { WidgetTodos } from "@/components/dashboard/widget-todos";
import { WidgetNotes } from "@/components/dashboard/widget-notes";
import { getFamily, getSetupStatus, listMembers } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const status = await getSetupStatus();
  if (!status.setupComplete) {
    redirect("/setup");
  }

  const [members, family] = await Promise.all([listMembers(), getFamily()]);

  const memberSummaries = members.map((m) => ({
    id: m.id,
    name: m.name,
    color: m.color,
    emoji: m.emoji,
  }));

  return (
    <AppShell>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-6">
        <WidgetChores className="md:col-span-12" members={memberSummaries} />
        <WidgetToday className="md:col-span-12 lg:col-span-8" members={memberSummaries} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:col-span-12 md:gap-6 lg:col-span-4 lg:grid-cols-1 lg:content-start">
          <WidgetClock className="max-md:hidden" />
          <WidgetWeather location={family?.weatherLabel} />
        </div>
        <WidgetTodos className="md:col-span-6" members={memberSummaries} />
        <WidgetNotes className="md:col-span-6" />
      </div>
    </AppShell>
  );
}

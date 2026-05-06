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
      <div className="grid grid-cols-1 md:grid-cols-6 xl:grid-cols-12 gap-4 md:gap-6 xl:auto-rows-[minmax(140px,auto)]">
        <WidgetClock className="md:col-span-3 xl:col-span-4 xl:row-span-2" />
        <WidgetToday
          className="md:col-span-3 xl:col-span-4 xl:row-span-3"
          members={memberSummaries}
        />
        <WidgetChores
          className="md:col-span-6 xl:col-span-4 xl:row-span-3"
          members={memberSummaries}
        />
        <WidgetWeather
          className="md:col-span-3 xl:col-span-4 xl:row-start-3"
          location={family?.weatherLabel}
        />
        <WidgetTodos className="md:col-span-3 xl:col-span-6 xl:row-span-2" />
        <WidgetNotes className="md:col-span-6 xl:col-span-6 xl:row-span-2" />
      </div>
    </AppShell>
  );
}

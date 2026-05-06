import { AppShell } from "@/components/shell/app-shell";

export default function Loading() {
  return (
    <AppShell>
      <div className="grid grid-cols-1 md:grid-cols-6 xl:grid-cols-12 gap-4 md:gap-6">
        <div className="card-soft md:col-span-3 xl:col-span-4 h-56 animate-pulse" />
        <div className="card-soft md:col-span-3 xl:col-span-4 h-72 animate-pulse" />
        <div className="card-soft md:col-span-6 xl:col-span-4 h-72 animate-pulse" />
        <div className="card-soft md:col-span-3 xl:col-span-6 h-44 animate-pulse" />
        <div className="card-soft md:col-span-3 xl:col-span-6 h-44 animate-pulse" />
      </div>
    </AppShell>
  );
}

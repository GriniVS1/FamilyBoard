import { AppShell } from "@/components/shell/app-shell";
import { Skeleton } from "@/components/kids/state-views";

export default function Loading() {
  return (
    <AppShell>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-6" aria-busy="true">
        <Skeleton className="h-44 rounded-3xl md:col-span-12" />
        <Skeleton className="h-96 rounded-3xl md:col-span-12 lg:col-span-8" />
        <div className="flex flex-col gap-4 md:col-span-12 md:gap-6 lg:col-span-4">
          <Skeleton className="h-36 rounded-3xl" />
          <Skeleton className="h-56 rounded-3xl" />
        </div>
        <Skeleton className="h-56 rounded-3xl md:col-span-6" />
        <Skeleton className="h-56 rounded-3xl md:col-span-6" />
      </div>
    </AppShell>
  );
}

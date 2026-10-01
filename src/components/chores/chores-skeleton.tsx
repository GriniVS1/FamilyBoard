import { Skeleton } from "@/components/kids/state-views";
import { toneOf } from "@/components/kids/tone";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { cn } from "@/lib/utils";
import type { ChoreMember } from "./types";

type ChoresSkeletonProps = {
  members: readonly ChoreMember[];
  /** Wall and tablet lay columns side by side; the phone stacks them. */
  wall: boolean;
};

/** Columns only: same head and card heights as the real ones so nothing jumps on arrival. */
export function ChoresSkeleton({ members, wall }: ChoresSkeletonProps) {
  return (
    <>
      {members.map((m) => (
        <div
          key={m.id}
          className={cn(
            "flex flex-col gap-3 rounded-4xl p-3 md:p-4",
            toneOf(m.color).tint,
            wall && "h-full shrink-0 grow basis-[var(--col-w)]",
          )}
        >
          <div className="flex h-24 items-center gap-3">
            <MemberAvatar size="lg" name={m.name} color={m.color} emoji={m.emoji} />
            <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-10 w-20 rounded-full" />
            </div>
          </div>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-3xl md:h-24" />
          ))}
        </div>
      ))}
    </>
  );
}

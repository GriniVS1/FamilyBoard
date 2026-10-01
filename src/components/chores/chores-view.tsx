"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Lock } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  CelebrationLayer,
  useCelebration,
} from "@/components/kids/celebration";
import { KidToast, PHONE_TOAST_BAR_PX, PHONE_TOAST_BUFFER_PX } from "@/components/kids/kid-toast";
import {
  ParentModeBanner,
  ParentModeProvider,
  useParentMode,
} from "@/components/kids/parent-mode";
import { EmptyState, ErrorState } from "@/components/kids/state-views";
import { useIdleTimeout } from "@/components/kids/use-idle-timeout";
import { useIsWall } from "@/components/kids/use-is-wall";
import { useNow } from "@/components/kids/use-now";
import { useToastLift } from "@/components/kids/use-toast-lift";
import { Picto } from "@/components/pictos";
import { PointsOverview } from "@/components/points/points-overview";
import { PointsToast } from "@/components/points/points-toast";
import { usePointsFlow } from "@/components/points/use-points";
import { columnSummary, completionFor, isChoreDone, type ColumnSummary } from "@/lib/chore-state";
import {
  columnTapAllowed,
  layoutTapAllowedIn,
  PAGE_SCROLL_KEY,
  scrollTapAllowedIn,
  type LastCompletion,
} from "@/lib/tap-guards";
import { phaseOf } from "@/lib/time-of-day";
import { cn } from "@/lib/utils";
import { ChoreDialog } from "./chore-dialog";
import { DoneToast, type DoneEntry, type DoneSlots } from "./done-toast";
import { ChoresHeader, type AnyoneItem } from "./chores-header";
import { ChoresSkeleton } from "./chores-skeleton";
import { MemberColumn } from "./member-column";
import { taskPictoOf } from "./task-picto";
import type { Chore, ChoreMember, ChoresPayload } from "./types";
import {
  CHORES_QUERY_KEY,
  FRESH_UNDO_MS,
  REVEALED_UNDO_MS,
  useChoreActions,
  useChoreAdmin,
  useChoresQuery,
  type ChoreActionEvent,
  type FailureKind,
} from "./use-chores";
import { useViewportFill } from "./use-viewport-fill";
import { WhoDialog } from "./who-dialog";

type ChoresViewProps = {
  initialMembers: ChoreMember[];
};

type Point = { x: number; y: number };

type ErrorToast = {
  id: number;
  chore: Chore;
  memberId: string;
  failure: FailureKind;
  retry: "complete" | "undo";
};

type DialogState = { open: boolean; chore: Chore | null; memberId: string | null };

const FOCUS_IDLE_MS = 120_000;
const ERROR_TOAST_MS = 15_000;
/**
 * Kept free below the wall's columns so a toast never pushes them around. The toast
 * is 76 px tall and sits 12 px above the edge; main's own 48 px padding covers the rest.
 */
const TOAST_ROOM = 44;
const BLOCKED_FLASH_MS = 180;
const FOCUS_SCROLL_DELAY_MS = 500;
const EMPTY_COMPLETIONS: ChoresPayload["completionsToday"] = [];
const EMPTY_CHORES: Chore[] = [];

function visibleCenter(el: Element | null): Point | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const inView =
    r.width > 0 && r.right > 0 && r.left < window.innerWidth && r.bottom > 0 && r.top < window.innerHeight;
  return inView ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
}

function byAttr(attr: string, value: string): Element | null {
  return document.querySelector(`[${attr}="${CSS.escape(value)}"]`);
}

export function ChoresView(props: ChoresViewProps) {
  return (
    <ParentModeProvider>
      <ChoresBoard {...props} />
    </ParentModeProvider>
  );
}

function ChoresBoard({ initialMembers }: ChoresViewProps) {
  const t = useTranslations("chores");
  const tKids = useTranslations("kids");
  const client = useQueryClient();
  const parent = useParentMode();
  const wall = useIsWall();
  const now = useNow();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data, isError, refetch } = useChoresQuery();
  const admin = useChoreAdmin();
  const { events: celebrations, fire: fireCelebration, remove: removeCelebration } = useCelebration();

  const [errorToast, setErrorToast] = useState<ErrorToast | null>(null);
  const [slots, setSlots] = useState<DoneSlots>([null, null]);
  const [who, setWho] = useState<Chore | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ open: false, chore: null, memberId: null });
  const [pointsOpen, setPointsOpen] = useState(false);
  const points = usePointsFlow();
  const [pulse, setPulse] = useState<Record<string, number>>({});
  const lastScrollAt = useRef(new Map<string, number>());
  const lastShiftAt = useRef(new Map<string, number>());
  const lastCompletion = useRef<LastCompletion | null>(null);
  const lastPointerAt = useRef(0);
  const origins = useRef(new Map<string, Point>());
  const toastSeq = useRef(0);

  const requested = searchParams.get("member");
  const focusId =
    requested && initialMembers.some((m) => m.id === requested) ? requested : null;
  const focusMember = initialMembers.find((m) => m.id === focusId) ?? null;

  // Not router.replace: that re-renders the server page (a DB round trip) per tap.
  // Entering the focus from "all" adds a history entry so Back returns to "all";
  // switching person replaces it. The flag lives in history.state because a
  // state object that already carries Next's internals would bypass its URL sync.
  const setFocus = useCallback(
    (id: string | null) => {
      const pushed = (window.history.state as { focusPush?: boolean } | null)?.focusPush === true;
      if (id === null) {
        if (pushed) window.history.back();
        else window.history.replaceState({ focusPush: false }, "", pathname);
        return;
      }
      const url = `${pathname}?member=${encodeURIComponent(id)}`;
      if (focusId === null) window.history.pushState({ focusPush: true }, "", url);
      else window.history.replaceState({ focusPush: pushed }, "", url);
    },
    [pathname, focusId],
  );
  useIdleTimeout(focusId !== null, FOCUS_IDLE_MS, () => setFocus(null));

  const chores = data?.chores ?? EMPTY_CHORES;
  const completions = data?.completionsToday ?? EMPTY_COMPLETIONS;

  const summaries = useMemo(() => {
    const map = new Map<string, ColumnSummary<Chore>>();
    if (!now) return map;
    for (const m of initialMembers) map.set(m.id, columnSummary(m.id, chores, completions, now));
    return map;
  }, [initialMembers, chores, completions, now]);

  const unassigned = useMemo(() => chores.filter((c) => c.memberId === null), [chores]);
  const anyoneItems = useMemo<AnyoneItem[]>(() => {
    const doneIds = new Set(completions.map((c) => c.choreId));
    const items = unassigned.map((chore) => {
      const completion = completionFor(chore.id, completions);
      return {
        chore,
        done: doneIds.has(chore.id),
        stamp: completion ? (initialMembers.find((m) => m.id === completion.memberId) ?? null) : null,
      };
    });
    return [...items.filter((i) => !i.done), ...items.filter((i) => i.done)];
  }, [unassigned, completions, initialMembers]);

  const dismissError = useCallback(() => setErrorToast(null), []);

  // Two fixed places. A task already shown keeps its place; otherwise the free one, otherwise the older entry is replaced in place.
  const addDone = useCallback((chore: Chore, memberId: string, ms: number) => {
    const entry: DoneEntry = { key: (toastSeq.current += 1), chore, memberId, expiresAt: Date.now() + ms };
    setSlots(([a, b]) => {
      if (a?.chore.id === chore.id) return [entry, b];
      if (b?.chore.id === chore.id) return [a, entry];
      if (!a) return [entry, b];
      if (!b) return [a, entry];
      return a.key < b.key ? [entry, b] : [a, entry];
    });
  }, []);

  const removeDoneFor = useCallback((choreId: string) => {
    setSlots(([a, b]) => [a?.chore.id === choreId ? null : a, b?.chore.id === choreId ? null : b]);
  }, []);

  const expireSlot = useCallback((slot: 0 | 1, key: number) => {
    setSlots(([a, b]) => {
      if (slot === 0) return a?.key === key ? [null, b] : [a, b];
      return b?.key === key ? [a, null] : [a, b];
    });
  }, []);

  const handleEvent = useCallback(
    (event: ChoreActionEvent) => {
      const id = (toastSeq.current += 1);

      if (event.type === "completed") {
        const { chore, memberId } = event;
        const payload = client.getQueryData<ChoresPayload>(CHORES_QUERY_KEY);
        const summary =
          payload && chore.memberId === memberId
            ? columnSummary(memberId, payload.chores, payload.completionsToday, new Date())
            : null;
        const columnDone = Boolean(summary && summary.total > 0 && summary.open === 0);
        const columnEl = columnDone ? byAttr("data-member-column", memberId) : null;
        const columnRect = columnEl && visibleCenter(columnEl) ? columnEl.getBoundingClientRect() : null;
        const member = initialMembers.find((m) => m.id === memberId);

        fireCelebration({
          from: origins.current.get(chore.id) ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 },
          to:
            visibleCenter(byAttr("data-star-target", memberId)) ??
            visibleCenter(byAttr("data-avatar-target", memberId)),
          points: chore.points,
          memberId,
          column: columnRect
            ? { left: columnRect.left, top: columnRect.top, width: columnRect.width, height: columnRect.height }
            : null,
          label: columnDone
            ? t("celebrateSr", { name: member?.name ?? "" })
            : t("toast.stars", { name: member?.name ?? "", count: chore.points }),
        });
        origins.current.delete(chore.id);
        lastCompletion.current = { columnKey: chore.memberId ?? "anyone", choreId: chore.id, at: Date.now() };
        addDone(chore, memberId, FRESH_UNDO_MS);
      } else if (event.type === "undone") {
        removeDoneFor(event.chore.id);
      } else if (event.type === "failed") {
        setErrorToast({
          id,
          chore: event.chore,
          memberId: event.memberId,
          failure: event.kind,
          retry: "complete",
        });
      } else {
        setErrorToast({
          id,
          chore: event.chore,
          memberId: event.memberId,
          failure: event.kind,
          retry: "undo",
        });
      }
    },
    [client, fireCelebration, initialMembers, t, addDone, removeDoneFor],
  );

  const actions = useChoreActions(handleEvent);

  const handleArrive = useCallback((memberId: string) => {
    setPulse((p) => ({ ...p, [memberId]: (p[memberId] ?? 0) + 1 }));
  }, []);

  /** An ignored tap still answers with a short press; nothing changes and nothing moves. */
  function flashBlocked(card: HTMLElement) {
    const surface = card.closest("[data-task-card]")?.querySelector<HTMLElement>("[data-card-surface]") ?? card;
    surface.dataset.blocked = "true";
    window.setTimeout(() => delete surface.dataset.blocked, BLOCKED_FLASH_MS);
  }

  function handlePress(chore: Chore, card: HTMLElement) {
    const now = Date.now();
    // Cards of this column just scrolled or moved, or a card in it was just ticked: the finger was aiming at something else.
    const columnKey = chore.memberId ?? "anyone";
    if (!scrollTapAllowedIn(lastScrollAt.current, columnKey, now)) return;
    if (
      !layoutTapAllowedIn(lastShiftAt.current, columnKey, now) ||
      !columnTapAllowed(lastCompletion.current, columnKey, chore.id, now)
    ) {
      flashBlocked(card);
      return;
    }

    const failure = actions.failed[chore.id];
    if (failure) {
      void actions.complete(chore, failure.memberId);
      return;
    }

    if (isChoreDone(chore.id, completions)) {
      // Fresh tick: its toast is already up. Older: the same toast for this chore (E13).
      if (actions.undoWindows[chore.id]) return;
      const completion = completions.find((c) => c.choreId === chore.id);
      if (!completion) return;
      actions.revealUndo(chore.id);
      addDone(chore, completion.memberId, REVEALED_UNDO_MS);
      return;
    }

    const ring = card.querySelector("[data-check-ring]") ?? card;
    const rect = ring.getBoundingClientRect();
    origins.current.set(chore.id, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });

    if (chore.memberId) void actions.complete(chore, chore.memberId);
    else setWho(chore);
  }

  const handleLayoutShift = useCallback((columnKey: string) => {
    lastShiftAt.current.set(columnKey, Date.now());
  }, []);

  function pickWho(memberId: string) {
    if (!who) return;
    void actions.complete(who, memberId);
    setWho(null);
  }

  function scrollToAnyone() {
    byAttr("data-member-column", "anyone")?.scrollIntoView({
      behavior: "smooth",
      block: wall ? "nearest" : "start",
      inline: "end",
    });
  }

  const openCreate = useCallback(
    (memberId: string | null) => setDialog({ open: true, chore: null, memberId }),
    [],
  );
  const openEdit = useCallback(
    (chore: Chore) => setDialog({ open: true, chore, memberId: chore.memberId }),
    [],
  );

  const ready = Boolean(data) && now !== null;
  const fatal = isError && !data;
  const nothingYet = ready && chores.length === 0;
  const showAnyone = unassigned.length > 0 || parent.active;
  const fill = useViewportFill<HTMLDivElement>(wall && !nothingYet && !fatal, TOAST_ROOM);
  // Tablet: two columns. From ~850px: every person side by side (each at least
  // 260px), so only the "for everyone" column may need a swipe at 1280px.
  const columnWidth = cn(
    "[--col-w:calc((100%_-_12px)_/_2)]",
    parent.active
      ? "min-[848px]:[--col-w:380px]"
      : "min-[848px]:[--col-w:clamp(260px,calc((100%_-_(var(--n)_-_1)_*_12px)_/_var(--n)),420px)]",
  );
  // One more column when even "for everyone" fits beside the people at 260px each.
  const people = Math.max(1, initialMembers.length);
  const allFit =
    showAnyone && fill.width !== null && (people + 1) * 260 + people * 12 <= fill.width;
  const columnStyle = { "--n": allFit ? people + 1 : people } as CSSProperties;

  // The phone page scrolls, so the toast bar gets its room once and for all: it then
  // never has to appear or disappear with a padding change that could shift cards.
  useEffect(() => {
    if (wall) return;
    const main = document.querySelector("main");
    if (!main) return;
    const before = main.style.paddingBottom;
    main.style.paddingBottom = `calc(${getComputedStyle(main).paddingBottom} + ${PHONE_TOAST_BAR_PX + PHONE_TOAST_BUFFER_PX}px)`;
    return () => {
      main.style.paddingBottom = before;
    };
  }, [wall]);

  useEffect(() => {
    if (!focusId || !ready) return;
    const enteredAt = Date.now();
    const timer = window.setTimeout(() => {
      if (lastPointerAt.current > enteredAt) return;
      document
        .querySelector(`[data-member-column="${CSS.escape(focusId)}"] [data-next="true"]`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, FOCUS_SCROLL_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [focusId, ready]);

  const columnProps = {
    members: initialMembers,
    chores,
    completions,
    weeklyByChore: data?.weeklyByChore ?? {},
    failed: actions.failed,
    pending: actions.pending,
    undoWindows: actions.undoWindows,
    parentActive: parent.active,
    onPress: handlePress,
    onEdit: openEdit,
    onAdd: openCreate,
    onFocus: (id: string) => setFocus(id === focusId ? null : id),
    onLayoutShift: handleLayoutShift,
  };

  function renderMemberColumn(member: ChoreMember, layout: "column" | "stack" | "focus") {
    if (!now) return null;
    return (
      <MemberColumn
        key={member.id}
        layout={layout}
        member={member}
        {...columnProps}
        chores={chores.filter((c) => c.memberId === member.id)}
        now={now}
        balance={data?.balanceByMember[member.id]?.balance ?? 0}
        pulseKey={pulse[member.id] ?? 0}
      />
    );
  }

  function renderAnyone(layout: "column" | "stack" | "strip") {
    if (!now) return null;
    return (
      <MemberColumn
        layout={layout}
        {...columnProps}
        chores={unassigned}
        now={now}
        balance={0}
        pulseKey={0}
      />
    );
  }

  let body: ReactNode;
  if (fatal) {
    body = <ErrorState onRetry={() => void refetch()} detail={t("couldNotLoad")} />;
  } else if (!ready) {
    body = (
      <div
        ref={fill.ref}
        style={{ ...fill.style, ...columnStyle }}
        className={cn(wall ? cn("flex min-h-0 gap-3 overflow-hidden", columnWidth) : "flex flex-col gap-4")}
      >
        <ChoresSkeleton members={initialMembers} wall={wall} />
      </div>
    );
  } else if (nothingYet) {
    body = (
      <EmptyState
        title={t("emptyTitle")}
        description={parent.active ? undefined : t("emptyHint")}
        onCreate={parent.active ? () => openCreate(null) : undefined}
        createLabel={t("addChore")}
      >
        {!parent.active && (
          <span aria-hidden className="inline-flex items-center gap-2 text-ink">
            <ArrowUpRight className="size-12" strokeWidth={3} />
            <Lock className="size-6" strokeWidth={2.5} />
          </span>
        )}
      </EmptyState>
    );
  } else if (focusMember) {
    body = (
      <div
        ref={fill.ref}
        style={fill.style}
        className={cn(
          "flex flex-col gap-4",
          wall && "overflow-y-auto overscroll-contain transition-[height] duration-200 ease-snappy",
        )}
      >
        {renderMemberColumn(focusMember, "focus")}
        {renderAnyone("strip")}
      </div>
    );
  } else if (wall) {
    body = (
      <div
        ref={fill.ref}
        style={{ ...fill.style, ...columnStyle }}
        className={cn(
          "flex min-h-0 snap-x snap-proximity gap-3 overflow-x-auto overflow-y-hidden transition-[height] duration-200 ease-snappy [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          columnWidth,
        )}
      >
        {initialMembers.map((m) => renderMemberColumn(m, "column"))}
        {showAnyone && renderAnyone("column")}
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col gap-4">
        {initialMembers.map((m) => renderMemberColumn(m, "stack"))}
        {showAnyone && renderAnyone("stack")}
      </div>
    );
  }

  const lift = useToastLift(
    !errorToast && (slots[0] !== null || slots[1] !== null),
    !errorToast && points.toast !== null,
  );

  const errorPicto = errorToast
    ? (taskPictoOf(errorToast.chore.icon, errorToast.chore.title) ?? "celebrate")
    : "celebrate";

  return (
    <div
      className="flex flex-col gap-4"
      onPointerDownCapture={() => {
        lastPointerAt.current = Date.now();
      }}
      onScrollCapture={(e) => {
        const column = (e.target as HTMLElement).closest?.("[data-member-column]");
        lastScrollAt.current.set(column?.getAttribute("data-member-column") ?? PAGE_SCROLL_KEY, Date.now());
      }}
    >
      <ChoresHeader
        members={initialMembers}
        summaries={summaries}
        focusId={focusId}
        phase={now ? phaseOf(now) : null}
        wall={wall}
        anyone={anyoneItems}
        inFocus={focusId !== null}
        onAnyonePress={handlePress}
        onAnyoneGo={scrollToAnyone}
        stale={isError && Boolean(data)}
        onRetry={() => void refetch()}
        onFocus={setFocus}
        onNew={() => openCreate(focusId)}
        onPoints={() => setPointsOpen(true)}
      />

      <ParentModeBanner />

      {body}

      <ChoreDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        members={initialMembers}
        chore={dialog.chore}
        initial={{ memberId: dialog.memberId }}
        onSave={admin.save}
        onDelete={admin.remove}
      />

      <PointsOverview
        open={pointsOpen}
        onOpenChange={setPointsOpen}
        members={initialMembers}
        onReset={points.reset}
      />

      <WhoDialog
        open={who !== null}
        onOpenChange={(open) => !open && setWho(null)}
        chore={who}
        members={initialMembers}
        onPick={pickWho}
      />

      <CelebrationLayer events={celebrations} onRemove={removeCelebration} onArrive={handleArrive} />

      {errorToast ? (
        <KidToast
          key={errorToast.id}
          tone="error"
          picto={errorPicto}
          aside={<Picto name="oops" size={36} />}
          centerOn="main"
          action={{
            kind: "retry",
            onClick: () => {
              const { chore, memberId, retry } = errorToast;
              void (retry === "complete" ? actions.complete(chore, memberId) : actions.undo(chore));
            },
          }}
          durationMs={ERROR_TOAST_MS}
          onDismiss={dismissError}
        >
          {errorToast.failure === "offline" ? tKids("offline") : tKids("errorGeneric")}
        </KidToast>
      ) : (
        <>
          <DoneToast
            slots={slots}
            members={initialMembers}
            centerOn="main"
            lift={lift.first}
            onUndo={(chore) => void actions.undo(chore)}
            onExpire={expireSlot}
          />
          {points.toast && (
            <PointsToast
              toast={points.toast}
              members={initialMembers}
              centerOn="main"
              lift={lift.second}
              onUndo={(resets) => void points.undo(resets)}
              onRetry={(retry) => void points.retry(retry)}
              onDismiss={points.dismiss}
            />
          )}
        </>
      )}
    </div>
  );
}

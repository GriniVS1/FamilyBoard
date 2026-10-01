import type { Member, Prisma, PrismaClient } from "@prisma/client";
import type {
  MemberBalance,
  MemberPoints,
  PointsOverview,
} from "@/components/chores/types";
import { db } from "./db";
import { env, googleConfigured } from "./env";
import { isAdminPinSet } from "./pin";
import { computeBalance } from "./points.ts";

export type WeeklyChoreTotals = { points: number; completions: number };
export type WeeklyChoreSummary = {
  weeklyByMember: Record<string, WeeklyChoreTotals>;
  weeklyByChore: Record<string, WeeklyChoreTotals>;
};

/**
 * Returns the current ISO week range with Monday as the start, in UTC.
 * `start` is Monday 00:00:00.000 UTC of the current week.
 * `end` is the next Monday 00:00:00.000 UTC (exclusive).
 */
export function getCurrentWeekRange(now: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const utcDay = now.getUTCDay(); // 0=Sun, 1=Mon, ... 6=Sat
  const daysSinceMonday = (utcDay + 6) % 7; // Mon -> 0, Sun -> 6
  const start = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - daysSinceMonday,
      0,
      0,
      0,
      0,
    ),
  );
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { start, end };
}

/**
 * Local-timezone day boundaries: midnight today -> midnight tomorrow (exclusive).
 * Single source of truth so wall and mobile agree on what "today" means.
 */
export function getTodayRange(now: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  );
  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    0,
  );
  return { start, end };
}

export type ChoreCompletionToday = {
  id: string;
  choreId: string;
  memberId: string;
  completedAt: string;
};

export async function getChoreCompletionsTodayForFamily(
  familyId: string,
): Promise<ChoreCompletionToday[]> {
  const { start, end } = getTodayRange();
  const rows = await db.choreCompletion.findMany({
    where: {
      completedAt: { gte: start, lt: end },
      chore: { familyId },
    },
    orderBy: { completedAt: "asc" },
    select: { id: true, choreId: true, memberId: true, completedAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    choreId: r.choreId,
    memberId: r.memberId,
    completedAt: r.completedAt.toISOString(),
  }));
}

/**
 * Aggregates ChoreCompletion rows for the current week (Mon-as-start, UTC),
 * scoped to a family. Returns totals grouped by member and by chore.
 */
export async function getWeeklyChoreSummaryForFamily(
  familyId: string,
): Promise<WeeklyChoreSummary> {
  const { start, end } = getCurrentWeekRange();

  const completions = await db.choreCompletion.findMany({
    where: {
      completedAt: { gte: start, lt: end },
      chore: { familyId },
    },
    include: { chore: { select: { id: true, points: true } } },
  });

  const weeklyByMember: Record<string, WeeklyChoreTotals> = {};
  const weeklyByChore: Record<string, WeeklyChoreTotals> = {};

  for (const c of completions) {
    const points = c.chore.points;
    const choreId = c.chore.id;

    const memberBucket = weeklyByMember[c.memberId] ?? {
      points: 0,
      completions: 0,
    };
    memberBucket.points += points;
    memberBucket.completions += 1;
    weeklyByMember[c.memberId] = memberBucket;

    const choreBucket = weeklyByChore[choreId] ?? {
      points: 0,
      completions: 0,
    };
    choreBucket.points += points;
    choreBucket.completions += 1;
    weeklyByChore[choreId] = choreBucket;
  }

  return { weeklyByMember, weeklyByChore };
}

/**
 * Weekly totals for a single member in the current week.
 */
export async function getWeeklyTotalsForMember(
  memberId: string,
): Promise<WeeklyChoreTotals> {
  const { start, end } = getCurrentWeekRange();
  const completions = await db.choreCompletion.findMany({
    where: {
      memberId,
      completedAt: { gte: start, lt: end },
    },
    include: { chore: { select: { points: true } } },
  });
  let points = 0;
  for (const c of completions) points += c.chore.points;
  return { points, completions: completions.length };
}

type DbClient = PrismaClient | Prisma.TransactionClient;

export type PointsBalance = { balance: number; since: Date | null };

const POINT_HISTORY_LIMIT = 10;

/**
 * Balance (points since the last reset) per member, two queries regardless of
 * family size: the newest reset per member, then only the completions that
 * count towards each member's current balance. With `memberIds`, every listed
 * member is present in the result (0 / null when nothing is known); without it,
 * only members that have a completion or a reset appear.
 *
 * `until` caps the counted completions (inclusive) so a reset stamped at that
 * instant partitions the timeline exactly, even if a completion lands while the
 * reset is being written.
 */
export async function getPointsBalances(
  client: DbClient,
  familyId: string,
  options: { memberIds?: readonly string[]; until?: Date } = {},
): Promise<Map<string, PointsBalance>> {
  const { memberIds, until } = options;

  const latestResets = await client.pointReset.groupBy({
    by: ["memberId"],
    where: {
      member: {
        familyId,
        ...(memberIds ? { id: { in: [...memberIds] } } : {}),
      },
    },
    _max: { resetAt: true },
  });

  const sinceByMember = new Map<string, Date>();
  for (const row of latestResets) {
    if (row._max.resetAt) sinceByMember.set(row.memberId, row._max.resetAt);
  }
  const resetMemberIds = [...sinceByMember.keys()];

  const neverReset: Prisma.ChoreCompletionWhereInput = memberIds
    ? { memberId: { in: memberIds.filter((id) => !sinceByMember.has(id)) } }
    : { memberId: { notIn: resetMemberIds } };

  const completions = await client.choreCompletion.findMany({
    where: {
      AND: [
        { chore: { familyId } },
        ...(until ? [{ completedAt: { lte: until } }] : []),
        {
          OR: [
            neverReset,
            ...resetMemberIds.map((memberId) => ({
              memberId,
              completedAt: { gt: sinceByMember.get(memberId) },
            })),
          ],
        },
      ],
    },
    select: {
      memberId: true,
      completedAt: true,
      chore: { select: { points: true } },
    },
  });

  const rowsByMember = new Map<string, { points: number; completedAt: Date }[]>();
  for (const c of completions) {
    const rows = rowsByMember.get(c.memberId) ?? [];
    rows.push({ points: c.chore.points, completedAt: c.completedAt });
    rowsByMember.set(c.memberId, rows);
  }

  const result = new Map<string, PointsBalance>();
  const ids = new Set<string>([
    ...(memberIds ?? []),
    ...rowsByMember.keys(),
    ...resetMemberIds,
  ]);
  for (const id of ids) {
    const since = sinceByMember.get(id) ?? null;
    result.set(id, {
      balance: computeBalance(rowsByMember.get(id) ?? [], since),
      since,
    });
  }
  return result;
}

/**
 * Balances for `GET /api/chores`. Members with nothing collected and no reset
 * are omitted; a member that was reset stays (even at 0) so `since` is known.
 */
export async function getBalanceByMemberForFamily(
  familyId: string,
): Promise<Record<string, MemberBalance>> {
  const balances = await getPointsBalances(db, familyId);
  const result: Record<string, MemberBalance> = {};
  for (const [memberId, { balance, since }] of balances) {
    if (balance === 0 && since === null) continue;
    result[memberId] = { balance, since: since?.toISOString() ?? null };
  }
  return result;
}

/**
 * Parent overview: every member of the family (also at 0), oldest first.
 * `weekly` reuses the weekly chore summary so it always matches `weeklyByMember`.
 */
export async function getPointsOverviewForFamily(
  familyId: string,
): Promise<PointsOverview> {
  const members = await db.member.findMany({
    where: { familyId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const memberIds = members.map((m) => m.id);

  const [resets, completions, summary] = await Promise.all([
    db.pointReset.findMany({
      where: { memberId: { in: memberIds } },
      orderBy: [{ resetAt: "desc" }, { id: "desc" }],
      select: { id: true, memberId: true, points: true, resetAt: true },
    }),
    db.choreCompletion.findMany({
      where: { memberId: { in: memberIds }, chore: { familyId } },
      select: {
        memberId: true,
        completedAt: true,
        chore: { select: { points: true } },
      },
    }),
    getWeeklyChoreSummaryForFamily(familyId),
  ]);

  const resetsByMember = new Map<string, typeof resets>();
  for (const reset of resets) {
    const list = resetsByMember.get(reset.memberId) ?? [];
    list.push(reset);
    resetsByMember.set(reset.memberId, list);
  }

  const rowsByMember = new Map<string, { points: number; completedAt: Date }[]>();
  for (const c of completions) {
    const rows = rowsByMember.get(c.memberId) ?? [];
    rows.push({ points: c.chore.points, completedAt: c.completedAt });
    rowsByMember.set(c.memberId, rows);
  }

  const overview: MemberPoints[] = memberIds.map((memberId) => {
    const memberResets = resetsByMember.get(memberId) ?? [];
    const rows = rowsByMember.get(memberId) ?? [];
    const since = memberResets[0]?.resetAt ?? null;
    return {
      memberId,
      balance: computeBalance(rows, since),
      since: since?.toISOString() ?? null,
      weekly: summary.weeklyByMember[memberId]?.points ?? 0,
      allTime: computeBalance(rows, null),
      history: memberResets.slice(0, POINT_HISTORY_LIMIT).map((r) => ({
        id: r.id,
        points: r.points,
        resetAt: r.resetAt.toISOString(),
      })),
    };
  });

  return { members: overview };
}

export async function getOrCreateInstallation() {
  let installation = await db.installation.findFirst();
  if (!installation) {
    installation = await db.installation.create({
      data: { appVersion: env.APP_VERSION },
    });
  } else if (installation.appVersion !== env.APP_VERSION) {
    // Keep the recorded version in sync after an OTA update swapped the image.
    installation = await db.installation.update({
      where: { id: installation.id },
      data: { appVersion: env.APP_VERSION },
    });
  }
  return installation;
}

export async function getFamily() {
  return db.family.findFirst();
}

export type PublicMember = {
  id: string;
  familyId: string;
  name: string;
  color: string;
  emoji: string | null;
  role: string;
  createdAt: Date;
  googleConnected: boolean;
  googleEmail: string | null;
  googleSyncEnabled: boolean;
  googleAuthFailedAt: Date | null;
  caldavConnected: boolean;
  caldavCalendarName: string | null;
  caldavSyncEnabled: boolean;
  caldavSyncedAt: Date | null;
  microsoftConnected: boolean;
  microsoftEmail: string | null;
  microsoftSyncEnabled: boolean;
  microsoftSyncedAt: Date | null;
  microsoftAuthFailedAt: Date | null;
};

// Explicit allowlist rather than stripping known secrets: a Member row carries
// OAuth tokens, CalDAV credentials and sync cursors, and a column added later
// must stay private until someone deliberately exposes it here.
export function toPublicMember(member: Member): PublicMember {
  return {
    id: member.id,
    familyId: member.familyId,
    name: member.name,
    color: member.color,
    emoji: member.emoji,
    role: member.role,
    createdAt: member.createdAt,
    googleConnected: Boolean(member.googleRefreshTokenEnc),
    googleEmail: member.googleEmail,
    googleSyncEnabled: member.googleSyncEnabled,
    googleAuthFailedAt: member.googleAuthFailedAt,
    caldavConnected: Boolean(member.caldavPasswordEnc),
    caldavCalendarName: member.caldavCalendarName,
    caldavSyncEnabled: member.caldavSyncEnabled,
    caldavSyncedAt: member.caldavSyncedAt,
    microsoftConnected: Boolean(member.microsoftRefreshTokenEnc),
    microsoftEmail: member.microsoftEmail,
    microsoftSyncEnabled: member.microsoftSyncEnabled,
    microsoftSyncedAt: member.microsoftSyncedAt,
    microsoftAuthFailedAt: member.microsoftAuthFailedAt,
  };
}

export async function listMembers(): Promise<PublicMember[]> {
  const members = await db.member.findMany({ orderBy: { createdAt: "asc" } });
  return members.map(toPublicMember);
}

export async function createFamilyIfMissing(name: string) {
  const existing = await db.family.findFirst();
  if (existing) return existing;

  const installation = await getOrCreateInstallation();
  const family = await db.family.create({ data: { name } });
  await db.installation.update({
    where: { id: installation.id },
    data: { familyId: family.id },
  });
  return family;
}

export async function getFamilyId(): Promise<string | null> {
  const family = await db.family.findFirst({ select: { id: true } });
  return family?.id ?? null;
}

export async function listRecipes(familyId: string) {
  return db.recipe.findMany({
    where: { familyId },
    include: { ingredients: { orderBy: { order: "asc" } } },
    orderBy: { name: "asc" },
  });
}

export async function getMealPlansForWeek(familyId: string, from: Date, to: Date) {
  return db.mealPlan.findMany({
    where: { familyId, date: { gte: from, lt: to } },
    include: {
      recipe: { select: { id: true, name: true, imageUrl: true } },
      member: { select: { id: true, name: true, color: true } },
    },
    orderBy: [{ date: "asc" }, { slot: "asc" }],
  });
}

export async function listGroceryItems(familyId: string) {
  return db.groceryItem.findMany({
    where: { familyId },
    orderBy: [{ category: "asc" }, { order: "asc" }, { createdAt: "asc" }],
  });
}

export type MemberSummary = {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
};

const memberSummarySelect = {
  id: true,
  name: true,
  color: true,
  emoji: true,
} as const;

export type TodayEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  color: string | null;
};

export type TodayChore = {
  id: string;
  title: string;
  icon: string | null;
  points: number;
  memberId: string | null;
  member: MemberSummary | null;
  completedToday: boolean;
};

export type TodayTodo = {
  id: string;
  title: string;
  done: boolean;
  dueDate: string | null;
};

export type TodayPayload = {
  member: MemberSummary;
  today: { iso: string };
  events: TodayEvent[];
  chores: TodayChore[];
  todos: TodayTodo[];
};

/**
 * Builds the "today" snapshot for a mobile device's bound member.
 * Uses the server's local timezone for day boundaries — matches wall-side chore/event logic.
 */
export async function getTodayForMember(
  familyId: string,
  memberId: string,
): Promise<TodayPayload> {
  const member = await db.member.findUnique({
    where: { id: memberId },
    select: { id: true, name: true, color: true, emoji: true },
  });

  const iso = new Date().toISOString().slice(0, 10);

  if (!member) {
    return {
      member: { id: memberId, name: "", color: "", emoji: null },
      today: { iso },
      events: [],
      chores: [],
      todos: [],
    };
  }

  const { start: startOfToday, end: endOfToday } = getTodayRange();

  const [rawEvents, rawChores, rawTodos] = await Promise.all([
    db.event.findMany({
      where: {
        familyId,
        memberId,
        startsAt: { lt: endOfToday },
        endsAt: { gt: startOfToday },
      },
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        startsAt: true,
        endsAt: true,
        allDay: true,
        color: true,
      },
      orderBy: { startsAt: "asc" },
    }),

    db.chore.findMany({
      where: { familyId },
      select: {
        id: true,
        title: true,
        icon: true,
        points: true,
        memberId: true,
        member: { select: memberSummarySelect },
        completions: {
          where: {
            memberId,
            completedAt: { gte: startOfToday, lt: endOfToday },
          },
          select: { id: true },
          take: 1,
        },
      },
    }),

    db.todo.findMany({
      where: {
        familyId,
        OR: [{ memberId }, { memberId: null }],
      },
      select: {
        id: true,
        title: true,
        done: true,
        dueDate: true,
      },
      orderBy: [{ done: "asc" }, { createdAt: "desc" }],
      take: 50,
    }),
  ]);

  const events: TodayEvent[] = rawEvents.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    location: e.location,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt.toISOString(),
    allDay: e.allDay,
    color: e.color,
  }));

  // Incomplete chores first, then completed; within each group alphabetical by title.
  const chores: TodayChore[] = rawChores
    .map((ch) => ({
      id: ch.id,
      title: ch.title,
      icon: ch.icon,
      points: ch.points,
      memberId: ch.memberId,
      member: ch.member,
      completedToday: ch.completions.length > 0,
    }))
    .sort((a, b) => {
      if (a.completedToday !== b.completedToday) {
        return a.completedToday ? 1 : -1;
      }
      return a.title.localeCompare(b.title);
    });

  const todos: TodayTodo[] = rawTodos.map((t) => ({
    id: t.id,
    title: t.title,
    done: t.done,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
  }));

  return {
    member: {
      id: member.id,
      name: member.name,
      color: member.color,
      emoji: member.emoji,
    },
    today: { iso },
    events,
    chores,
    todos,
  };
}

export async function getScreensaverIdleMinutes(): Promise<number> {
  try {
    const row = await db.setting.findUnique({ where: { key: "screensaver_idle_minutes" } });
    if (!row) return 3;
    const n = Number(row.value);
    return Number.isFinite(n) && n >= 0 ? n : 3;
  } catch {
    return 3;
  }
}

export async function getSetupStatus() {
  const installation = await getOrCreateInstallation();
  const family = await db.family.findFirst();
  const memberCount = family
    ? await db.member.count({ where: { familyId: family.id } })
    : 0;
  const pinSet = await isAdminPinSet();
  const weatherSet = Boolean(
    family?.weatherLat != null &&
      family?.weatherLon != null &&
      family?.weatherLabel,
  );
  const familyCreated = Boolean(family);
  const setupComplete = familyCreated && memberCount >= 1 && pinSet;
  const localeChosen = Boolean(
    await db.setting.findUnique({ where: { key: "locale" } }),
  );

  return {
    installationId: installation.id,
    localeChosen,
    familyCreated,
    memberCount,
    pinSet,
    weatherSet,
    googleConfigured,
    setupComplete,
  };
}

export type ChoreListItem = {
  id: string;
  title: string;
  icon: string | null;
  points: number;
  rrule: string | null;
  timeOfDay: string | null;
  memberId: string | null;
  member: MemberSummary | null;
  completedToday: boolean;
  completedTodayBy: MemberSummary | null;
};

/**
 * Full family chore list for the mobile chores tab: each chore's own
 * assignee plus who (if anyone) actually completed it today — those can
 * differ when an unassigned chore gets done by whoever picks it up.
 */
export async function getChoresForFamily(
  familyId: string,
): Promise<ChoreListItem[]> {
  const { start: startOfToday, end: endOfToday } = getTodayRange();

  const rawChores = await db.chore.findMany({
    where: { familyId },
    select: {
      id: true,
      title: true,
      icon: true,
      points: true,
      rrule: true,
      timeOfDay: true,
      memberId: true,
      member: { select: memberSummarySelect },
      completions: {
        where: { completedAt: { gte: startOfToday, lt: endOfToday } },
        orderBy: { completedAt: "desc" },
        take: 1,
        select: { member: { select: memberSummarySelect } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const chores: ChoreListItem[] = rawChores.map((ch) => {
    const latestCompletion = ch.completions[0] ?? null;
    return {
      id: ch.id,
      title: ch.title,
      icon: ch.icon,
      points: ch.points,
      rrule: ch.rrule,
      timeOfDay: ch.timeOfDay,
      memberId: ch.memberId,
      member: ch.member,
      completedToday: latestCompletion !== null,
      completedTodayBy: latestCompletion ? latestCompletion.member : null,
    };
  });

  // Stable sort: open chores first, completed ones last; createdAt-desc order
  // from the query is preserved within each group.
  return chores.sort((a, b) =>
    a.completedToday === b.completedToday ? 0 : a.completedToday ? 1 : -1,
  );
}

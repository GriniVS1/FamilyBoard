import { db } from "./db";
import { googleConfigured } from "./env";
import { isAdminPinSet } from "./pin";

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

export async function getOrCreateInstallation() {
  let installation = await db.installation.findFirst();
  if (!installation) {
    installation = await db.installation.create({ data: {} });
  }
  return installation;
}

export async function getFamily() {
  return db.family.findFirst({
    include: { members: { orderBy: { createdAt: "asc" } } },
  });
}

export async function listMembers() {
  return db.member.findMany({ orderBy: { createdAt: "asc" } });
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
  completedToday: boolean;
};

export type TodayTodo = {
  id: string;
  title: string;
  done: boolean;
  dueDate: string | null;
};

export type TodayPayload = {
  member: { id: string; name: string; color: string; emoji: string | null };
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

  // Local-timezone day boundaries: midnight today → midnight tomorrow.
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  );
  const endOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    0,
  );

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

import { ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { getNotificationTranslator } from "@/lib/notification-i18n";
import { sendNotificationToFamily } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Setting key prefix for tracking already-notified event IDs per calendar date.
// Value is a JSON-encoded string[].
const NOTIFIED_KEY_PREFIX = "notifiedEventIds:";
const DIGEST_KEY = "lastDigestDate";

function toLocalDateString(): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function localHour(): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false }).format(
      new Date(),
    ),
  );
}

function formatHHMM(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

async function getNotifiedIds(dateKey: string): Promise<Set<string>> {
  const row = await db.setting.findUnique({
    where: { key: `${NOTIFIED_KEY_PREFIX}${dateKey}` },
  });
  if (!row) return new Set();
  try {
    return new Set(JSON.parse(row.value) as string[]);
  } catch {
    return new Set();
  }
}

async function markNotified(dateKey: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const existing = await getNotifiedIds(dateKey);
  const merged = [...existing, ...ids];
  await db.setting.upsert({
    where: { key: `${NOTIFIED_KEY_PREFIX}${dateKey}` },
    update: { value: JSON.stringify(merged) },
    create: {
      key: `${NOTIFIED_KEY_PREFIX}${dateKey}`,
      value: JSON.stringify(merged),
    },
  });
}

export const POST = withErrorHandling(async () => {
  await db.pairingCode.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { consumedAt: { not: null } },
      ],
    },
  });

  const family = await db.family.findFirst({ select: { id: true } });
  if (!family) return ok({ checked: 0, sent: 0 });

  const { t } = await getNotificationTranslator();

  const now = new Date();
  const horizon = new Date(now.getTime() + 75 * 60 * 1000);
  const todayKey = toLocalDateString();
  const notifiedIds = await getNotifiedIds(todayKey);

  let checked = 0;
  let totalSent = 0;

  // --- 1-hour-ahead event reminders ---
  const upcoming = await db.event.findMany({
    where: {
      familyId: family.id,
      allDay: false,
      startsAt: { gte: now, lte: horizon },
    },
    orderBy: { startsAt: "asc" },
  });

  checked = upcoming.length;
  const toNotify = upcoming.filter((e) => !notifiedIds.has(e.id));

  if (toNotify.length > 0) {
    const freshlyNotified: string[] = [];
    await Promise.all(
      toNotify.map(async (event) => {
        const result = await sendNotificationToFamily(family.id, {
          title: event.title,
          body: t("notifications.eventReminder.body", { time: formatHHMM(event.startsAt) }),
          url: "/calendar",
          tag: `event-reminder-${event.id}`,
        });
        totalSent += result.sent;
        freshlyNotified.push(event.id);
      }),
    );
    await markNotified(todayKey, freshlyNotified);
  }

  // --- Daily digest at 08:00 local time ---
  const hour = localHour();
  if (hour === 8) {
    const lastDigest = await db.setting.findUnique({ where: { key: DIGEST_KEY } });
    if (lastDigest?.value !== todayKey) {
      const digestResult = await buildAndSendDigest(family.id, now, t);
      totalSent += digestResult;
      await db.setting.upsert({
        where: { key: DIGEST_KEY },
        update: { value: todayKey },
        create: { key: DIGEST_KEY, value: todayKey },
      });
    }
  }

  return ok({ checked, sent: totalSent });
});

type Translator = Awaited<ReturnType<typeof getNotificationTranslator>>["t"];

async function buildAndSendDigest(
  familyId: string,
  now: Date,
  t: Translator,
): Promise<number> {
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);

  const [events, chores, dinnerPlan] = await Promise.all([
    db.event.findMany({
      where: {
        familyId,
        startsAt: { gte: dayStart, lte: dayEnd },
      },
      select: { id: true },
    }),
    db.chore.findMany({
      where: { familyId },
      select: { id: true },
    }),
    db.mealPlan.findFirst({
      where: {
        familyId,
        date: { gte: dayStart, lte: dayEnd },
        slot: "DINNER",
      },
      include: { recipe: { select: { name: true } } },
    }),
  ]);

  const parts: string[] = [];
  if (events.length > 0) {
    parts.push(t("notifications.digest.events", { count: events.length }));
  }
  if (dinnerPlan) {
    const name =
      dinnerPlan.recipe?.name ??
      dinnerPlan.customName ??
      t("notifications.digest.dinnerFallback");
    parts.push(name);
  }
  if (chores.length > 0) {
    parts.push(t("notifications.digest.chores", { count: chores.length }));
  }

  const separator = t("notifications.digest.separator");
  const body =
    parts.length > 0 ? parts.join(separator) : t("notifications.digest.empty");

  const result = await sendNotificationToFamily(familyId, {
    title: t("notifications.digest.title"),
    body,
    url: "/",
    tag: "daily-digest",
  });

  return result.sent;
}

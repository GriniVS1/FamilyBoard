import { z } from "zod";
import { AppError, ok, withErrorHandling } from "@/lib/api";
import { db } from "@/lib/db";
import { CHORE_TIME_OF_DAY } from "@/lib/enums";
import {
  getChoreCompletionsTodayForFamily,
  getCurrentWeekRange,
  getTodayRange,
  getWeeklyChoreSummaryForFamily,
} from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  memberId: z.string().min(1).optional().nullable(),
  title: z.string().trim().min(1).max(100),
  icon: z.string().max(16).optional().nullable(),
  points: z.number().int().min(1).max(50).optional().default(1),
  rrule: z.string().max(200).optional().nullable(),
  timeOfDay: z.enum(CHORE_TIME_OF_DAY).optional().nullable(),
});

const choreSelect = {
  id: true,
  familyId: true,
  memberId: true,
  title: true,
  icon: true,
  points: true,
  rrule: true,
  timeOfDay: true,
  createdAt: true,
} as const;

export const GET = withErrorHandling(async () => {
  const family = await db.family.findFirst();
  const { start, end } = getCurrentWeekRange();
  const today = getTodayRange();
  const todayIso = {
    start: today.start.toISOString(),
    end: today.end.toISOString(),
  };

  if (!family) {
    return ok({
      chores: [],
      weekStart: start.toISOString(),
      weekEnd: end.toISOString(),
      weeklyByMember: {},
      weeklyByChore: {},
      completionsToday: [],
      today: todayIso,
    });
  }

  const chores = await db.chore.findMany({
    where: { familyId: family.id },
    orderBy: { createdAt: "asc" },
    select: choreSelect,
  });

  const [summary, completionsToday] = await Promise.all([
    getWeeklyChoreSummaryForFamily(family.id),
    getChoreCompletionsTodayForFamily(family.id),
  ]);

  return ok({
    chores,
    weekStart: start.toISOString(),
    weekEnd: end.toISOString(),
    weeklyByMember: summary.weeklyByMember,
    weeklyByChore: summary.weeklyByChore,
    completionsToday,
    today: todayIso,
  });
});

export const POST = withErrorHandling(async (req) => {
  const body = createSchema.parse(await req.json());

  const family = await db.family.findFirst();
  if (!family) {
    throw new AppError(
      "Create a family before adding chores",
      "FAMILY_NOT_FOUND",
      400,
    );
  }

  if (body.memberId) {
    const member = await db.member.findUnique({
      where: { id: body.memberId },
    });
    if (!member || member.familyId !== family.id) {
      throw new AppError("Member not found", "MEMBER_NOT_FOUND", 404);
    }
  }

  const chore = await db.chore.create({
    data: {
      familyId: family.id,
      memberId: body.memberId ?? null,
      title: body.title,
      icon: body.icon ?? null,
      points: body.points,
      rrule: body.rrule ?? null,
      timeOfDay: body.timeOfDay ?? null,
    },
    select: choreSelect,
  });

  return ok(chore);
});

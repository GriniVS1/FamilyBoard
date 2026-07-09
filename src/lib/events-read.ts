import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { AppError } from "./api";
import {
  expandEventsInRange,
  type EventWithOverrides,
  type ExpandedEvent,
} from "./event-expansion";

export type EventRangeFilter = {
  from: Date;
  to: Date;
  familyId?: string;
  memberIds?: string[] | null;
};

function rangeWhere(filter: EventRangeFilter): Prisma.EventWhereInput {
  const { from, to, familyId, memberIds } = filter;
  return {
    ...(familyId ? { familyId } : {}),
    ...(memberIds ? { memberId: { in: memberIds } } : {}),
    // Normal events overlapping [from, to), plus any recurring series whose
    // master starts at or before the window end (it may still produce
    // occurrences inside the window even though its own startsAt is earlier).
    OR: [
      { rrule: null, startsAt: { lt: to }, endsAt: { gte: from } },
      { rrule: { not: null }, startsAt: { lte: to } },
    ],
  };
}

/**
 * Shared query/expand/filter/sort core behind both `GET /api/events` (wall)
 * and `GET /api/mobile/events`. Callers supply their own `include` for
 * relation shaping (e.g. mobile's trimmed `member` select) via the `Extra`
 * type param — the Prisma include itself is not type-checked against it, so
 * keep the two in sync at the call site.
 *
 * `cap`, when provided, is enforced on the EXPANDED occurrence count (a
 * single recurring master can fan out into many rows), not the raw row count.
 */
export async function fetchExpandedEventRows<
  Extra extends Record<string, unknown> = Record<string, never>,
>(
  filter: EventRangeFilter,
  include: Prisma.EventInclude,
  cap?: number,
): Promise<Array<ExpandedEvent & Extra>> {
  const rows = (await db.event.findMany({
    where: rangeWhere(filter),
    include,
  })) as unknown as Array<EventWithOverrides & Extra>;

  const expanded = expandEventsInRange(rows, filter.from, filter.to) as Array<
    ExpandedEvent & Extra
  >;

  if (cap !== undefined && expanded.length > cap) {
    throw new AppError(
      `Query would return ${expanded.length} events (cap is ${cap}). Narrow the date range.`,
      "RANGE_TOO_BROAD",
      400,
    );
  }

  const filtered = expanded.filter(
    (e) => e.endsAt >= filter.from && e.startsAt < filter.to,
  );

  filtered.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  return filtered;
}

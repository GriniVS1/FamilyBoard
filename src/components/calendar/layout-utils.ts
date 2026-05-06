import { differenceInMinutes, endOfDay, startOfDay } from "date-fns";
import { HOUR_START } from "./date-utils";
import type { CalendarEvent } from "./types";

export type PositionedEvent = {
  event: CalendarEvent;
  top: number;
  height: number;
  laneIndex: number;
  laneCount: number;
};

const SLOT_HEIGHT_PX = 56;
const MINUTES_PER_HOUR = 60;

export function pixelsPerMinute(): number {
  return SLOT_HEIGHT_PX / MINUTES_PER_HOUR;
}

export function slotHeightPx(): number {
  return SLOT_HEIGHT_PX;
}

/**
 * Given the events visible on a single day, compute their absolute pixel
 * position relative to the start hour of the timed grid, plus a simple lane
 * assignment so overlapping events sit side by side.
 */
export function layoutDayEvents(
  events: CalendarEvent[],
  day: Date,
): { timed: PositionedEvent[]; allDay: CalendarEvent[] } {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  const ppm = pixelsPerMinute();

  const allDay: CalendarEvent[] = [];
  const timed: { event: CalendarEvent; startMin: number; endMin: number }[] = [];

  for (const e of events) {
    const start = new Date(e.startsAt);
    const end = new Date(e.endsAt);
    if (e.allDay) {
      allDay.push(e);
      continue;
    }
    if (end <= dayStart || start >= dayEnd) continue;

    const clampedStart = start < dayStart ? dayStart : start;
    const clampedEnd = end > dayEnd ? dayEnd : end;

    // Convert to minutes from grid start (HOUR_START)
    const startMin = differenceInMinutes(clampedStart, dayStart) - HOUR_START * 60;
    const endMin = differenceInMinutes(clampedEnd, dayStart) - HOUR_START * 60;
    timed.push({ event: e, startMin, endMin });
  }

  timed.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  // Greedy column packing
  type Active = { lane: number; endMin: number };
  const lanes: Active[] = [];
  const groups: PositionedEvent[][] = [];
  let currentGroup: { items: { idx: number; lane: number; startMin: number; endMin: number }[]; maxLane: number } | null =
    null;

  function flushGroup() {
    if (!currentGroup) return;
    const laneCount = currentGroup.maxLane + 1;
    const positioned: PositionedEvent[] = currentGroup.items.map((it) => {
      const ev = timed[it.idx]!;
      const top = Math.max(0, it.startMin) * ppm;
      const height = Math.max(20, (it.endMin - it.startMin) * ppm);
      return {
        event: ev.event,
        top,
        height,
        laneIndex: it.lane,
        laneCount,
      };
    });
    groups.push(positioned);
    currentGroup = null;
  }

  let groupEndMin = -Infinity;

  for (let i = 0; i < timed.length; i += 1) {
    const item = timed[i]!;
    // remove lanes whose event has ended
    for (let j = lanes.length - 1; j >= 0; j -= 1) {
      if (lanes[j]!.endMin <= item.startMin) {
        lanes.splice(j, 1);
      }
    }

    if (lanes.length === 0 && item.startMin >= groupEndMin) {
      flushGroup();
    }

    // pick smallest unused lane
    const used = new Set(lanes.map((l) => l.lane));
    let lane = 0;
    while (used.has(lane)) lane += 1;
    lanes.push({ lane, endMin: item.endMin });

    if (!currentGroup) currentGroup = { items: [], maxLane: 0 };
    currentGroup.items.push({ idx: i, lane, startMin: item.startMin, endMin: item.endMin });
    currentGroup.maxLane = Math.max(currentGroup.maxLane, lane);
    groupEndMin = Math.max(groupEndMin, item.endMin);
  }
  flushGroup();

  return {
    timed: groups.flat(),
    allDay,
  };
}

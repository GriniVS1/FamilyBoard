import type { ChoreCompletion } from "@prisma/client";
import { db } from "./db";

export const DOUBLE_TAP_WINDOW_MS = 5_000;

const tails = new Map<string, Promise<void>>();

// Two overlapping taps would both pass the "recent completion?" check before
// either inserts; serialising per chore+member makes the check-then-create atomic
// within this single Node process (one process per installation).
async function withKeyLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = tails.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = prev.then(() => gate);
  tails.set(key, tail);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (tails.get(key) === tail) tails.delete(key);
  }
}

export async function recordChoreCompletion(
  choreId: string,
  memberId: string,
  now: Date = new Date(),
): Promise<{ completion: ChoreCompletion; deduped: boolean }> {
  return withKeyLock(`${choreId}:${memberId}`, async () => {
    const recent = await db.choreCompletion.findFirst({
      where: {
        choreId,
        memberId,
        completedAt: { gte: new Date(now.getTime() - DOUBLE_TAP_WINDOW_MS) },
      },
      orderBy: { completedAt: "desc" },
    });
    if (recent) return { completion: recent, deduped: true };

    const completion = await db.choreCompletion.create({
      data: { choreId, memberId },
    });
    return { completion, deduped: false };
  });
}

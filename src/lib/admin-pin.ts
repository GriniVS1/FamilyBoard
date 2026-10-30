import "server-only";

import { getSetupStatus } from "@/lib/queries";
import { verifyAdminPin } from "@/lib/pin";
import { AppError } from "@/lib/api";
import { getClientIp, hitRateLimit, refundRateLimit } from "@/lib/rate-limit";

// The 6-digit PIN only has ~1M combinations and every route that checks it is
// an oracle, so all of them draw from one shared budget: separate per-route
// buckets would let a guesser rotate routes, and an unthrottled route would be
// unlimited. The hourly ceiling keeps a patient guesser at ~1.4k tries a day.
const PIN_FAILURES_PER_MINUTE = 10;
const PIN_FAILURES_PER_HOUR = 60;

function tooManyAttempts(): AppError {
  return new AppError(
    "Too many PIN attempts. Please wait a minute.",
    "TOO_MANY_ATTEMPTS",
    429,
  );
}

// Checks an admin PIN against the stored hash under the shared attempt budget.
// The attempt is charged before the bcrypt compare (so concurrent guesses
// cannot all pass a not-yet-updated counter) and refunded when the PIN is
// right, so only failures count. An exhausted budget refuses even the correct
// PIN: answering it would turn the 429 into a free oracle.
export async function checkAdminPin(req: Request, pin: string): Promise<boolean> {
  const ip = getClientIp(req.headers);
  const minuteKey = `admin-pin:${ip}:m`;
  const hourKey = `admin-pin:${ip}:h`;

  if (!hitRateLimit(minuteKey, PIN_FAILURES_PER_MINUTE, 60_000).allowed) {
    throw tooManyAttempts();
  }
  if (!hitRateLimit(hourKey, PIN_FAILURES_PER_HOUR, 60 * 60_000).allowed) {
    refundRateLimit(minuteKey);
    throw tooManyAttempts();
  }

  const valid = await verifyAdminPin(pin);
  if (valid) {
    refundRateLimit(minuteKey);
    refundRateLimit(hourKey);
  }
  return valid;
}

export async function requireAdminPin(req: Request): Promise<void> {
  const { setupComplete } = await getSetupStatus();
  if (!setupComplete) return;

  // A request without a PIN cannot be a guess, so it must not spend the
  // budget the admin needs.
  const pin = req.headers.get("x-admin-pin");
  if (!pin) {
    throw new AppError("Admin PIN required", "PIN_REQUIRED", 403);
  }
  if (!(await checkAdminPin(req, pin))) {
    throw new AppError("Invalid admin PIN", "PIN_INVALID", 403);
  }
}

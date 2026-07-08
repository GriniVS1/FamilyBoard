import "server-only";

import { db } from "./db";
import { hostCommand } from "./network";

// Display sleep window ("screen off at night").
//
// Mechanism: inside the configured window we enable DPMS with a short idle
// timeout and force the panel off. A touch wakes the display (X handles that),
// and the idle timeout puts it back to sleep without any server involvement.
// Outside the window we restore the kiosk's always-on state (DPMS disabled —
// see scripts/pi/disable-blanking.sh and the .xinitrc xset calls).
//
// Times are compared against the HOST's local clock (via nsenter date), not
// the container's (UTC): the kiosk browser renders the host timezone, so the
// wall clock the user configured the window against is host-local by
// definition.

export type DisplaySleepSettings = {
  enabled: boolean;
  start: string; // "HH:MM"
  end: string; // "HH:MM"
};

const DEFAULTS: DisplaySleepSettings = {
  enabled: false,
  start: "22:00",
  end: "06:30",
};

// How long after a wake-up touch the panel goes back to sleep (seconds).
const RESLEEP_IDLE_S = 120;

const KEY_ENABLED = "display_sleep_enabled";
const KEY_START = "display_sleep_start";
const KEY_END = "display_sleep_end";
const KEY_ACTIVE = "display_sleep_active"; // last state we applied to X

// xset must talk to the kiosk user's X server on the host.
const X_ENV = ["DISPLAY=:0", "XAUTHORITY=/home/familyboard/.Xauthority"];

function xset(args: string[]) {
  return hostCommand(["env", ...X_ENV, "xset", ...args], 10_000);
}

async function getSetting(key: string): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  await db.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function getDisplaySleepSettings(): Promise<DisplaySleepSettings> {
  const [enabled, start, end] = await Promise.all([
    getSetting(KEY_ENABLED),
    getSetting(KEY_START),
    getSetting(KEY_END),
  ]);
  return {
    enabled: enabled === "true",
    start: start ?? DEFAULTS.start,
    end: end ?? DEFAULTS.end,
  };
}

export async function setDisplaySleepSettings(
  s: DisplaySleepSettings,
): Promise<void> {
  await Promise.all([
    setSetting(KEY_ENABLED, String(s.enabled)),
    setSetting(KEY_START, s.start),
    setSetting(KEY_END, s.end),
  ]);
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Overnight windows (22:00 → 06:30) are the normal case. start === end is
// treated as "never" rather than "always" — a zero-length window is the only
// sane reading of equal times, and it fails safe (screen stays on).
export function isInWindow(now: string, start: string, end: string): boolean {
  const n = toMinutes(now);
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === e) return false;
  if (s < e) return n >= s && n < e;
  return n >= s || n < e;
}

async function hostLocalTime(): Promise<string | null> {
  try {
    const { stdout } = await hostCommand(["date", "+%H:%M"], 10_000);
    const m = stdout.trim().match(/^\d{2}:\d{2}$/);
    return m ? m[0] : null;
  } catch {
    return null; // not an appliance (dev Mac / plain Docker)
  }
}

async function sleepDisplay(): Promise<void> {
  // Order matters: DPMS must be enabled before timeouts/force take effect.
  await xset(["+dpms"]);
  await xset(["dpms", "0", "0", String(RESLEEP_IDLE_S)]);
  await xset(["dpms", "force", "off"]);
}

async function wakeDisplay(): Promise<void> {
  await xset(["dpms", "force", "on"]);
  // Restore the kiosk's always-on state (mirrors .xinitrc).
  await xset(["-dpms"]);
  await xset(["s", "off"]);
  await xset(["s", "noblank"]);
}

// Called once a minute from instrumentation (via /api/system/display-tick) and
// after settings changes. Only acts on state transitions; while inside the
// window, wake-by-touch → re-sleep is handled entirely by X's DPMS idle timer.
export async function applyDisplaySleepTick(): Promise<{
  applied: "sleep" | "wake" | null;
}> {
  const settings = await getDisplaySleepSettings();
  const wasActive = (await getSetting(KEY_ACTIVE)) === "true";

  if (!settings.enabled) {
    if (wasActive) {
      try {
        await wakeDisplay();
      } catch (err) {
        console.warn(
          "[display] wake on disable failed",
          err instanceof Error ? err.message : err,
        );
      }
      await setSetting(KEY_ACTIVE, "false");
      return { applied: "wake" };
    }
    return { applied: null };
  }

  const now = await hostLocalTime();
  if (!now) return { applied: null }; // no host access — nothing to drive

  const inWindow = isInWindow(now, settings.start, settings.end);
  if (inWindow === wasActive) return { applied: null };

  try {
    if (inWindow) {
      await sleepDisplay();
    } else {
      await wakeDisplay();
    }
  } catch (err) {
    console.warn(
      `[display] ${inWindow ? "sleep" : "wake"} failed`,
      err instanceof Error ? err.message : err,
    );
    return { applied: null }; // keep state unchanged so the next tick retries
  }
  await setSetting(KEY_ACTIVE, String(inWindow));
  return { applied: inWindow ? "sleep" : "wake" };
}

export async function rebootHost(): Promise<void> {
  await hostCommand(["systemctl", "reboot"], 10_000);
}

export async function shutdownHost(): Promise<void> {
  await hostCommand(["systemctl", "poweroff"], 10_000);
}

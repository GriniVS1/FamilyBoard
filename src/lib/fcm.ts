import "server-only";
import { readFileSync } from "fs";
import { db } from "./db";
import { env } from "./env";
import type { NotificationPayload } from "./notifications";

// firebase-admin is a CommonJS module; use require so Next.js doesn't try to
// statically analyse the optional import chain when the env var is absent.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require("firebase-admin") as typeof import("firebase-admin");

let initialized: boolean | null = null;
let appInstance: import("firebase-admin/app").App | null = null;

function getFirebaseApp(): import("firebase-admin/app").App | null {
  if (initialized !== null) return appInstance;

  const path = env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!path) {
    initialized = false;
    return null;
  }

  try {
    const raw = readFileSync(path, "utf-8");
    const serviceAccount = JSON.parse(raw) as Record<string, unknown>;
    appInstance = admin.initializeApp(
      { credential: admin.credential.cert(serviceAccount) },
      "familyboard-fcm",
    );
    initialized = true;
    return appInstance;
  } catch (err) {
    initialized = false;
    // Single warn on first failure — callers treat FCM as optional.
    const reason = err instanceof Error ? err.message : String(err);
    console.warn("[fcm] Firebase Admin init failed — mobile push disabled:", reason);
    return null;
  }
}

export function isFcmConfigured(): boolean {
  return getFirebaseApp() !== null;
}

// Token-level error codes returned by FCM that mean the device token is dead.
const STALE_ERROR_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  // firebase-admin 12 normalises these older codes too
  "messaging/invalid-argument",
]);

export type FcmResult = { sent: number; failed: number; stale: number };

export async function sendPushToFamilyDevices(
  familyId: string,
  payload: NotificationPayload,
): Promise<FcmResult> {
  const app = getFirebaseApp();
  if (!app) return { sent: 0, failed: 0, stale: 0 };

  const devices = await db.mobileDevice.findMany({
    where: {
      familyId,
      revokedAt: null,
      fcmToken: { not: null },
    },
    select: { id: true, fcmToken: true },
  });

  if (devices.length === 0) return { sent: 0, failed: 0, stale: 0 };

  const messaging = admin.messaging(app);

  // Build one message per token so we can map results back to device rows.
  const tokens = devices.map((d) => d.fcmToken as string);

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: {
      url: payload.url ?? "/",
      tag: payload.tag ?? "",
    },
    android: { priority: "high" },
    apns: { payload: { aps: { sound: "default" } } },
  });

  let sent = 0;
  let failed = 0;
  const staleDeviceIds: string[] = [];

  response.responses.forEach((r, i) => {
    if (r.success) {
      sent++;
    } else {
      failed++;
      const code = r.error?.code ?? "";
      if (STALE_ERROR_CODES.has(code)) {
        staleDeviceIds.push(devices[i].id);
      }
    }
  });

  // Null-out dead tokens; keep the device row for non-push features.
  if (staleDeviceIds.length > 0) {
    await db.mobileDevice.updateMany({
      where: { id: { in: staleDeviceIds } },
      data: { fcmToken: null },
    });
  }

  return { sent, failed, stale: staleDeviceIds.length };
}

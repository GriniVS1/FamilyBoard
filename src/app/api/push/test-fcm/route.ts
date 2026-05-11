import { ok, fail, withErrorHandling, AppError } from "@/lib/api";
import { db } from "@/lib/db";
import { requireMobileAuth } from "@/lib/mobile-auth";
import { isFcmConfigured } from "@/lib/fcm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require("firebase-admin") as typeof import("firebase-admin");

export const POST = withErrorHandling(async (req) => {
  const ctx = await requireMobileAuth(req);

  if (!isFcmConfigured()) {
    return fail("FCM_NOT_CONFIGURED", "Firebase Cloud Messaging is not configured on this server", 503);
  }

  const device = await db.mobileDevice.findUnique({
    where: { id: ctx.deviceId },
    select: { fcmToken: true },
  });

  if (!device?.fcmToken) {
    throw new AppError("No FCM token registered for this device", "NO_FCM_TOKEN", 422);
  }

  const app = admin.app("familyboard-fcm");
  const messaging = admin.messaging(app);

  const messageId = await messaging.send({
    token: device.fcmToken,
    notification: {
      title: "Test push",
      body: "FamilyBoard FCM is working.",
    },
    data: {
      url: "/",
      tag: "test-fcm",
    },
    android: { priority: "high" },
    apns: { payload: { aps: { sound: "default" } } },
  });

  return ok({ ok: true, messageId });
});

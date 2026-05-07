import "server-only";
import webpush from "web-push";
import { db } from "./db";
import { env } from "./env";

let cached: { publicKey: string; privateKey: string } | null = null;

export function invalidateVapidCache(): void {
  cached = null;
}

export async function getVapidKeys(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  if (cached) return cached;

  // Env-provided keys take precedence over DB-stored ones so operators can
  // rotate keys without touching the database.
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    cached = {
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
    };
    return cached;
  }

  const [pub, priv] = await Promise.all([
    db.setting.findUnique({ where: { key: "vapidPublicKey" } }),
    db.setting.findUnique({ where: { key: "vapidPrivateKey" } }),
  ]);

  if (pub && priv) {
    cached = { publicKey: pub.value, privateKey: priv.value };
    return cached;
  }

  const generated = webpush.generateVAPIDKeys();
  await db.$transaction([
    db.setting.upsert({
      where: { key: "vapidPublicKey" },
      update: { value: generated.publicKey },
      create: { key: "vapidPublicKey", value: generated.publicKey },
    }),
    db.setting.upsert({
      where: { key: "vapidPrivateKey" },
      update: { value: generated.privateKey },
      create: { key: "vapidPrivateKey", value: generated.privateKey },
    }),
  ]);
  cached = generated;
  return cached;
}

export type NotificationPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export async function sendNotificationToFamily(
  familyId: string,
  payload: NotificationPayload,
): Promise<{ sent: number; failed: number }> {
  const keys = await getVapidKeys();
  webpush.setVapidDetails(
    "mailto:noreply@familyboard.local",
    keys.publicKey,
    keys.privateKey,
  );

  const subs = await db.pushSubscription.findMany({ where: { familyId } });
  let sent = 0;
  let failed = 0;
  const stale: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode;
        // 404/410 means the subscription is dead — schedule for deletion.
        if (status === 404 || status === 410) stale.push(s.endpoint);
        failed++;
      }
    }),
  );

  if (stale.length > 0) {
    await db.pushSubscription.deleteMany({
      where: { endpoint: { in: stale } },
    });
  }

  return { sent, failed };
}

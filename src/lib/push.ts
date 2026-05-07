"use client";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function getOrRegisterServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) throw new Error("Service workers not supported");
  return navigator.serviceWorker.register("/sw.js");
}

export async function subscribeToPush(): Promise<PushSubscription> {
  const reg = await getOrRegisterServiceWorker();
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;

  const { key } = await fetch("/api/push/vapid-public-key").then((r) => r.json()) as { key: string };
  if (!key) throw new Error("VAPID key missing");

  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key) as unknown as ArrayBuffer,
  });
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export async function unsubscribeFromPush(): Promise<void> {
  const sub = await getCurrentSubscription();
  if (!sub) return;
  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });
  await sub.unsubscribe();
}

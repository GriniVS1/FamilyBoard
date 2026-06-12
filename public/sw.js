self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = (() => {
    try { return event.data.json(); } catch { return { title: "FamilyBoard", body: event.data.text() }; }
  })();
  const title = data.title || "FamilyBoard";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url || "/" },
    tag: data.tag,
    renotify: !!data.tag,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Clamp navigation to a same-origin path — a notification payload must never
  // be able to send the wall to an external origin (defence in depth: payloads
  // are VAPID-authenticated and server-built, but openWindow would honour an
  // off-origin URL otherwise).
  let target = "/";
  try {
    const u = new URL(event.notification.data?.url || "/", self.location.origin);
    target = u.origin === self.location.origin ? u.pathname + u.search : "/";
  } catch { /* malformed URL — fall back to root */ }
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of all) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(target).catch(() => {});
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});

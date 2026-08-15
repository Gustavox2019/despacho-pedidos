// Service Worker mínimo. No cachea nada ni hace la app funcionar offline
// — su único propósito es habilitar las notificaciones en Android, donde
// Chrome exige que salgan desde un Service Worker (showNotification),
// no directo desde la página (new Notification(), eso solo funciona en PC).

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Si la persona toca la notificación, enfoca la pestaña de la app en vez
// de abrir una nueva.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    })
  );
});

// Service Worker — habilita las notificaciones en Android (Chrome ahí
// exige que salgan desde acá, no directo desde la página) y recibe los
// pushes reales (funcionan aunque el navegador esté cerrado).

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Llega un push real del servidor (con el navegador abierto o cerrado).
self.addEventListener("push", (event) => {
  let datos = {};
  try { datos = event.data ? event.data.json() : {}; } catch (e) { /* payload no era JSON válido */ }

  const titulo = datos.titulo || "Despacho";
  const opciones = {
    body: datos.cuerpo || "",
    icon: "/icon.png",
    badge: "/icon.png",
    vibrate: [200, 100, 200],
    tag: datos.tag || undefined,
    data: { url: datos.url || "/" }
  };

  event.waitUntil((async () => {
    await self.registration.showNotification(titulo, opciones);
    // El Service Worker no puede reproducir sonido (no tiene Web Audio).
    // Si hay alguna pestaña de la app abierta, le pedimos que suene el
    // timbre de alarma ella misma.
    const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clientList) client.postMessage({ tipo: "reproducir-sonido" });
  })());
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

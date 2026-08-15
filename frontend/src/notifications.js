// Notificaciones del navegador (no push real — no necesita backend ni
// service worker, funciona mientras la pestaña siga abierta, aunque esté
// en segundo plano). El polling de la app (cada 5s) llama a estas
// funciones cuando detecta algo nuevo.

export function soportaNotificaciones() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function permisoActual() {
  if (!soportaNotificaciones()) return "unsupported";
  return Notification.permission; // "default" | "granted" | "denied"
}

export async function pedirPermiso() {
  if (!soportaNotificaciones()) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch (err) {
    return "denied";
  }
}

export function notificar(titulo, opciones = {}) {
  if (!soportaNotificaciones() || Notification.permission !== "granted") return;
  try {
    const n = new Notification(titulo, { icon: "/icon.png", badge: "/icon.png", ...opciones });
    n.onclick = () => { window.focus(); n.close(); };
  } catch (err) { /* algunos navegadores móviles no soportan "new Notification" directo, se ignora */ }
}

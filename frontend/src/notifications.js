// Notificaciones del navegador (con Service Worker + Push real, así
// funciona igual que las notificaciones de mensajería o de ofertas de una
// tienda: llegan aunque el navegador esté cerrado).
//
// Nota sobre Android: Chrome en Android NO permite crear la notificación
// directo desde la página con "new Notification(...)" (solo funciona así
// en PC) — exige que salga desde un Service Worker, por eso acá se
// registra uno (public/sw.js) y se usa registration.showNotification().

import { api } from "./api.js";

export function soportaNotificaciones() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function soportaPush() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
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

let swRegistrationPromise = null;
function registrarServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return Promise.resolve(null);
  if (!swRegistrationPromise) {
    swRegistrationPromise = navigator.serviceWorker.register("/sw.js").catch(() => null);
  }
  return swRegistrationPromise;
}

// Se llama una vez al cargar la app: deja el Service Worker listo, y
// escucha los avisos que le mande cuando llegue un push real (para poder
// reproducir el sonido de alarma, algo que el Service Worker no puede
// hacer por sí solo).
export function inicializarServiceWorker() {
  registrarServiceWorker();
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.tipo === "reproducir-sonido") reproducirSonido();
    });
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// Suscribe este dispositivo/navegador a notificaciones push reales y
// guarda la suscripción en el backend. Se puede llamar de nuevo sin
// problema (por ejemplo cada vez que se abre la app con permiso ya
// concedido) — es idempotente, el backend actualiza en vez de duplicar.
export async function suscribirseAPush(user) {
  if (!soportaPush() || !user) return false;
  try {
    const registro = await registrarServiceWorker();
    if (!registro) return false;

    let suscripcion = await registro.pushManager.getSubscription();
    if (!suscripcion) {
      const { clave } = await api.obtenerClavePublicaPush();
      if (!clave) return false; // el backend todavía no tiene las llaves VAPID configuradas
      suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(clave)
      });
    }

    await api.suscribirPush({ userId: user.id, rol: user.rol, subscription: suscripcion.toJSON() });
    return true;
  } catch (err) {
    console.error("No se pudo suscribir a notificaciones push:", err);
    return false;
  }
}

// --- Sonido tipo alarma (como un timbre de llamada corto) ---
// Se genera con Web Audio en vez de un archivo de audio, así no depende
// de subir/cargar ningún mp3. Ojo: esto SOLO puede sonar si hay una
// pestaña de la app abierta — con el navegador cerrado, la notificación
// push igual llega, pero suena con el tono por defecto del celular (el
// Service Worker no tiene acceso a Web Audio).
let audioCtx = null;
function obtenerAudioCtx() {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

// Los navegadores solo dejan sonar audio después de que la persona
// interactuó con la página (click, tap). Se llama una vez, apenas el
// usuario hace login, para "desbloquear" el audio de entrada.
export function desbloquearSonido() {
  const ctx = obtenerAudioCtx();
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
}

// Dos "timbrazos" cortos (cada uno alternando entre dos tonos, como una
// alarma o el timbre de una llamada).
export function reproducirSonido() {
  try {
    const ctx = obtenerAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const ahora = ctx.currentTime;

    function timbrazo(inicio) {
      const tonos = [1046, 784]; // alterna agudo/grave, como un timbre
      const duracionTono = 0.11;
      tonos.forEach((freq, i) => {
        const t0 = inicio + i * duracionTono;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square"; // más "eléctrico"/urgente que una onda senoidal
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.16, t0 + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duracionTono - 0.015);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + duracionTono);
      });
    }

    timbrazo(ahora);
    timbrazo(ahora + 0.32);
  } catch (err) { /* silencioso — si el navegador bloquea el audio, no rompe nada */ }
}

// Notificación disparada desde la propia página (se usa poco ahora que
// el servidor manda pushes reales, pero se deja por si hace falta algún
// aviso puramente local).
export async function notificar(titulo, opciones = {}) {
  reproducirSonido();
  if (!soportaNotificaciones() || Notification.permission !== "granted") return;
  const opcionesFinales = { icon: "/icon.png", badge: "/icon.png", vibrate: [200, 100, 200], ...opciones };
  try {
    const registro = await registrarServiceWorker();
    if (registro && registro.showNotification) {
      await registro.showNotification(titulo, opcionesFinales);
      return;
    }
  } catch (err) { /* probamos el camino de respaldo abajo */ }
  try {
    const n = new Notification(titulo, opcionesFinales);
    n.onclick = () => { window.focus(); n.close(); };
  } catch (err) { /* se ignora — en Android este camino no funciona de todos modos */ }
}

// Notificaciones del navegador (no push real — no necesita backend propio
// de push, funciona mientras la pestaña siga abierta, aunque esté en
// segundo plano). El polling de la app (cada 5s) llama a estas funciones
// cuando detecta algo nuevo.
//
// Nota sobre Android: Chrome en Android NO permite crear la notificación
// directo desde la página con "new Notification(...)" (solo funciona así
// en PC) — exige que salga desde un Service Worker, por eso acá se
// registra uno (public/sw.js) y se usa registration.showNotification().

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
    const resultado = await Notification.requestPermission();
    if (resultado === "granted") await registrarServiceWorker();
    return resultado;
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

// Se llama una vez al cargar la app, así el Service Worker ya está listo
// para cuando haga falta mostrar la primera notificación.
export function inicializarServiceWorker() {
  registrarServiceWorker();
}

// --- Sonido tipo alarma (como un timbre de llamada corto) ---
// Se genera con Web Audio en vez de un archivo de audio, así no depende
// de subir/cargar ningún mp3.
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
// alarma o el timbre de una llamada), en vez del "ding" suave de antes.
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

    // Dos timbrazos seguidos, con una pequeña pausa entre ellos.
    timbrazo(ahora);
    timbrazo(ahora + 0.32);
  } catch (err) { /* silencioso — si el navegador bloquea el audio, no rompe nada */ }
}

export async function notificar(titulo, opciones = {}) {
  reproducirSonido();
  if (!soportaNotificaciones() || Notification.permission !== "granted") return;

  const opcionesFinales = { icon: "/icon.png", badge: "/icon.png", vibrate: [200, 100, 200], ...opciones };

  // Camino normal (Android y navegadores modernos): mostrarla vía el
  // Service Worker.
  try {
    const registro = await registrarServiceWorker();
    if (registro && registro.showNotification) {
      await registro.showNotification(titulo, opcionesFinales);
      return;
    }
  } catch (err) { /* si falla, probamos el camino de PC de abajo */ }

  // Camino de respaldo (funciona en PC; en Android esto directamente no
  // hace nada porque el navegador lo bloquea, por eso el intento de
  // arriba va primero).
  try {
    const n = new Notification(titulo, opcionesFinales);
    n.onclick = () => { window.focus(); n.close(); };
  } catch (err) { /* se ignora */ }
}

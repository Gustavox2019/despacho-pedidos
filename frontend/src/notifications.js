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

// --- Sonido tipo mensajería (dos tonos cortos, como un "ding-dong") ---
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

export function reproducirSonido() {
  try {
    const ctx = obtenerAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const ahora = ctx.currentTime;
    // Dos tonos cortos y agudos, como el "ding-dong" de una app de chat.
    [[880, 0], [660, 0.12]].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ahora + delay);
      gain.gain.exponentialRampToValueAtTime(0.22, ahora + delay + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, ahora + delay + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ahora + delay);
      osc.stop(ahora + delay + 0.2);
    });
  } catch (err) { /* silencioso — si el navegador bloquea el audio, no rompe nada */ }
}

export function notificar(titulo, opciones = {}) {
  reproducirSonido();
  if (!soportaNotificaciones() || Notification.permission !== "granted") return;
  try {
    const n = new Notification(titulo, { icon: "/icon.png", badge: "/icon.png", ...opciones });
    n.onclick = () => { window.focus(); n.close(); };
  } catch (err) { /* algunos navegadores móviles no soportan "new Notification" directo, se ignora */ }
}

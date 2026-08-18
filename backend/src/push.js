import webpush from "web-push";
import "dotenv/config";
import { supabase } from "./supabase.js";

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || "mailto:soporte@example.com";

let configurado = false;
if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configurado = true;
} else {
  console.warn(
    "\n⚠️  Notificaciones push desactivadas: faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY en el .env del backend." +
    "\n    La app funciona igual, solo no va a poder mandar avisos con el navegador cerrado.\n"
  );
}

export function pushConfigurado() { return configurado; }
export function vapidPublicKey() { return publicKey || null; }

// Manda un push a TODAS las suscripciones guardadas de un usuario puntual
// (puede tener varios dispositivos suscritos).
export async function enviarPushAUsuario(userId, payload) {
  if (!configurado || !userId) return;
  const { data, error } = await supabase.from("push_subscriptions").select("*").eq("user_id", userId);
  if (error || !data) return;
  await enviarATodas(data, payload);
}

// Manda un push a todos los suscritos con cierto rol (ej: avisarle a todo
// el almacén de un pedido nuevo, sin importar quién lo termine tomando).
export async function enviarPushARol(rol, payload) {
  if (!configurado) return;
  const { data, error } = await supabase.from("push_subscriptions").select("*").eq("rol", rol);
  if (error || !data) return;
  await enviarATodas(data, payload);
}

async function enviarATodas(filas, payload) {
  const cuerpo = JSON.stringify(payload);
  await Promise.all(filas.map(async (fila) => {
    const suscripcion = {
      endpoint: fila.endpoint,
      keys: { p256dh: fila.p256dh, auth: fila.auth }
    };
    try {
      await webpush.sendNotification(suscripcion, cuerpo);
    } catch (err) {
      // 404/410 = esa suscripción ya no existe (el usuario desinstaló,
      // borró datos del sitio, etc.) — se limpia sola de la base.
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", fila.endpoint);
      } else {
        console.error("Error enviando push:", err.message);
      }
    }
  }));
}

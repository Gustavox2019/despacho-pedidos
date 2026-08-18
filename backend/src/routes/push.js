import { Router } from "express";
import { supabase } from "../supabase.js";
import { vapidPublicKey } from "../push.js";

const router = Router();

// La clave pública NO es secreta (se llama así justamente por eso) — el
// frontend la necesita para poder suscribirse.
router.get("/clave-publica", (req, res) => {
  res.json({ clave: vapidPublicKey() });
});

// Guarda (o actualiza) la suscripción de este dispositivo/navegador.
router.post("/suscribir", async (req, res) => {
  try {
    const { userId, rol, subscription } = req.body;
    if (!userId || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: "Datos de suscripción incompletos." });
    }
    const { error } = await supabase.from("push_subscriptions").upsert({
      endpoint: subscription.endpoint,
      user_id: userId,
      rol: rol || null,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth
    }, { onConflict: "endpoint" });
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo guardar la suscripción." });
  }
});

router.post("/desuscribir", async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: "Falta el endpoint." });
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo eliminar la suscripción." });
  }
});

export default router;

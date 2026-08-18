import { Router } from "express";
import { supabase } from "../supabase.js";
import { enviarPushAUsuario } from "../push.js";

const router = Router();

// Solo pueden ver/usar el chat de un pedido: el vendedor que lo creó, y
// (si ya lo tomó alguien) el almacenero que lo tomó. Nadie más — así el
// chat no se llena de gente ajena al pedido. Devuelve el pedido (o null
// si no existe / no tiene acceso) para reusar sus datos después.
async function pedidoConAcceso(pedidoId, solicitanteId) {
  if (!solicitanteId) return null;
  const { data, error } = await supabase
    .from("pedidos")
    .select("id, cliente, vendedor_id, almacenero_id")
    .eq("id", pedidoId)
    .maybeSingle();
  if (error || !data) return null;
  const tieneAcceso = data.vendedor_id === solicitanteId || data.almacenero_id === solicitanteId;
  return tieneAcceso ? data : null;
}

router.get("/:pedidoId", async (req, res) => {
  try {
    const pedido = await pedidoConAcceso(req.params.pedidoId, req.query.solicitanteId);
    if (!pedido) return res.status(403).json({ error: "No tienes acceso al chat de este pedido." });

    const { data, error } = await supabase
      .from("chats")
      .select("mensajes")
      .eq("pedido_id", req.params.pedidoId)
      .maybeSingle();
    if (error) throw error;
    res.json(data?.mensajes || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo cargar el chat." });
  }
});

router.post("/:pedidoId", async (req, res) => {
  try {
    const { autor, rol, texto, solicitanteId } = req.body;
    if (!texto || !texto.trim()) return res.status(400).json({ error: "Mensaje vacío." });

    const pedido = await pedidoConAcceso(req.params.pedidoId, solicitanteId);
    if (!pedido) return res.status(403).json({ error: "No tienes acceso al chat de este pedido." });

    const { data: existente, error: errLectura } = await supabase
      .from("chats")
      .select("mensajes")
      .eq("pedido_id", req.params.pedidoId)
      .maybeSingle();
    if (errLectura) throw errLectura;

    const mensajes = existente?.mensajes || [];
    const nuevo = {
      id: "m-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      autor, rol, texto: texto.trim(), ts: Date.now()
    };
    mensajes.push(nuevo);

    const { error: errGuardar } = await supabase
      .from("chats")
      .upsert({ pedido_id: req.params.pedidoId, mensajes });
    if (errGuardar) throw errGuardar;

    // Avisamos al pedido quién mandó el último mensaje, para que el lado
    // que NO escribió vea la notificación de "mensaje nuevo" (el que sí
    // escribió obviamente ya lo vio).
    const marcaVisto = rol === "vendedor"
      ? { chat_visto_almacen: false, chat_visto_vendedor: true }
      : { chat_visto_vendedor: false, chat_visto_almacen: true };
    await supabase
      .from("pedidos")
      .update({ ultimo_mensaje_en: nuevo.ts, ultimo_mensaje_autor_rol: rol, ...marcaVisto })
      .eq("id", req.params.pedidoId);

    res.json(mensajes);

    // Push a la otra persona del pedido (nunca a quien acaba de escribir).
    const destinatarioId = rol === "vendedor" ? pedido.almacenero_id : pedido.vendedor_id;
    if (destinatarioId) {
      enviarPushAUsuario(destinatarioId, {
        titulo: "Nuevo mensaje",
        cuerpo: `Pedido ${pedido.id} · ${pedido.cliente}: ${nuevo.texto.slice(0, 80)}`,
        tag: `chat-${pedido.id}`,
        url: "/"
      }).catch(err => console.error("Push (chat) falló:", err.message));
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo enviar el mensaje." });
  }
});

export default router;

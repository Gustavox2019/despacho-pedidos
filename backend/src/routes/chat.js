import { Router } from "express";
import { supabase } from "../supabase.js";

const router = Router();

router.get("/:pedidoId", async (req, res) => {
  try {
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
    const { autor, rol, texto } = req.body;
    if (!texto || !texto.trim()) return res.status(400).json({ error: "Mensaje vacío." });

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

    res.json(mensajes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo enviar el mensaje." });
  }
});

export default router;

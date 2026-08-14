import { Router } from "express";
import { db } from "../firebase.js";

const router = Router();

router.get("/:pedidoId", async (req, res) => {
  try {
    const doc = await db.collection("chats").doc(req.params.pedidoId).get();
    res.json(doc.exists ? doc.data().mensajes || [] : []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo cargar el chat." });
  }
});

router.post("/:pedidoId", async (req, res) => {
  try {
    const { autor, rol, texto } = req.body;
    if (!texto || !texto.trim()) return res.status(400).json({ error: "Mensaje vacío." });
    const ref = db.collection("chats").doc(req.params.pedidoId);
    const doc = await ref.get();
    const mensajes = doc.exists ? doc.data().mensajes || [] : [];
    const nuevo = { id: "m-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7), autor, rol, texto: texto.trim(), ts: Date.now() };
    mensajes.push(nuevo);
    await ref.set({ mensajes });
    res.json(mensajes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo enviar el mensaje." });
  }
});

export default router;

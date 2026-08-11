import { Router } from "express";
import { matchCode } from "../matching.js";

const router = Router();

// Recibe pares {cantidad, codigo} ya extraídos (ej. de un Excel) y los
// contrasta contra el catálogo — no necesita IA porque el dato ya viene
// estructurado, a diferencia de una foto.
router.post("/", (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: "Formato inválido." });

    const resultado = items.map((it, i) => {
      const m = matchCode(it.codigo || "");
      return {
        id: "it-" + Date.now() + "-" + i,
        cantidad: Number(it.cantidad) || 1,
        codigo: m.code,
        matchStatus: m.status,
        piso: ""
      };
    });

    res.json({ items: resultado });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo procesar la lista." });
  }
});

export default router;

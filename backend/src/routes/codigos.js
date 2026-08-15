import { Router } from "express";
import { buscarCodigos } from "../matching.js";

const router = Router();

// Sugerencias de códigos mientras el vendedor/almacenero escribe uno a
// mano (agregar línea manual, corregir un código, agregar producto).
router.get("/buscar", (req, res) => {
  try {
    const q = (req.query.q || "").toString();
    if (!q.trim()) return res.json({ codigos: [] });
    res.json({ codigos: buscarCodigos(q, 8) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo buscar códigos." });
  }
});

export default router;

import { Router } from "express";
import { llamarGemini } from "../geminiClient.js";

const router = Router();

const PROMPT = `Estás viendo una foto de la etiqueta, empaque o el propio repuesto/autoparte.
Identifica el CÓDIGO DE PARTE/PRODUCTO visible — suele ser alfanumérico (letras y números,
a veces con guiones). NO es el código de barras largo de puros números (tipo EAN/UPC) ni el precio.
Si hay varios números, elige el que parezca el código de parte del fabricante.
Responde ÚNICAMENTE con JSON, sin texto adicional ni markdown:
{"codigo": "el código en mayúsculas, o null si no se distingue ningún código de parte"}`;

router.post("/", async (req, res) => {
  try {
    const { imageBase64, mediaType } = req.body;
    if (!imageBase64) return res.status(400).json({ error: "Falta la imagen." });

    const data = await llamarGemini(() => ({
      contents: [{
        parts: [
          { inline_data: { mime_type: mediaType || "image/jpeg", data: imageBase64 } },
          { text: PROMPT }
        ]
      }],
      generationConfig: { responseMimeType: "application/json" }
    }));

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(502).json({ error: "Respuesta vacía del modelo." });

    const clean = text.trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(clean);

    res.json({ codigo: parsed.codigo || null });
  } catch (err) {
    console.error(err);
    if (err.status === 429) {
      return res.status(429).json({
        error: "Se llegó al límite diario de lecturas automáticas. Escribe el código a mano mientras tanto."
      });
    }
    if (err.status === 503) {
      return res.status(503).json({
        error: "El servicio de lectura automática está saturado en este momento (ya se intentó varias veces). Intenta de nuevo en un minuto, o escribe el código a mano."
      });
    }
    res.status(502).json({ error: "No se pudo leer la foto del producto." });
  }
});

export default router;

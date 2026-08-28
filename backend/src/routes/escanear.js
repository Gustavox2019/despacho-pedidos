import { Router } from "express";
import "dotenv/config";

const router = Router();
const GEMINI_MODEL = "gemini-3.1-flash-lite";

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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Falta configurar GEMINI_API_KEY en el backend." });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mediaType || "image/jpeg", data: imageBase64 } },
            { text: PROMPT }
          ]
        }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Error de Gemini:", data);
      if (response.status === 429) {
        return res.status(429).json({
          error: "Se llegó al límite diario de lecturas automáticas. Escribe el código a mano mientras tanto."
        });
      }
      return res.status(502).json({ error: "No se pudo leer la foto del producto." });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(502).json({ error: "Respuesta vacía del modelo." });

    const clean = text.trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(clean);

    res.json({ codigo: parsed.codigo || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo procesar la foto." });
  }
});

export default router;

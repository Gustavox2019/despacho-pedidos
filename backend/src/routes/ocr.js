import { Router } from "express";
import "dotenv/config";
import { matchCode } from "../matching.js";

const router = Router();

const GEMINI_MODEL = "gemini-3.6-flash";

const PROMPT = `Eres un asistente que transcribe listas de pedidos de repuestos para un almacén.
La imagen puede ser: (a) una lista escrita a mano con lapicero, o (b) una captura de pantalla de celdas de Excel.
Extrae cada línea de producto como un objeto con:
- "cantidad": número (si no aparece, usa 1)
- "codigo": el código de producto tal como aparece escrito, en mayúsculas, conservando guiones/espacios internos si los tiene.
Ignora encabezados, totales, firmas o texto que no sea parte de la lista de productos.
Si logras identificar un nombre de cliente escrito en la imagen, inclúyelo en "cliente" (si no, usa null).
Responde ÚNICAMENTE con un JSON válido, sin texto adicional, sin markdown, con este formato exacto:
{"cliente": "string o null", "items": [{"cantidad": number, "codigo": "string"}]}`;

router.post("/", async (req, res) => {
  try {
    const { imageBase64, mediaType } = req.body;
    if (!imageBase64) return res.status(400).json({ error: "Falta la imagen." });
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Falta configurar GEMINI_API_KEY en el archivo .env del backend." });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;

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
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Error de Gemini:", data);
      return res.status(502).json({ error: "El servicio de transcripción no respondió correctamente." });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(502).json({ error: "Respuesta vacía del modelo." });

    let clean = text.trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(clean);

    const items = (parsed.items || []).map((it, i) => {
      const m = matchCode(it.codigo || "");
      return {
        id: "it-" + Date.now() + "-" + i,
        cantidad: Number(it.cantidad) || 1,
        codigo: m.code,
        matchStatus: m.status,
        piso: ""
      };
    });

    res.json({ cliente: parsed.cliente || null, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo leer la imagen automáticamente." });
  }
});

export default router;

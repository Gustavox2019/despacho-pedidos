import { Router } from "express";
import { matchCode } from "../matching.js";
import { llamarGemini } from "../geminiClient.js";

const router = Router();

const PROMPT = `Eres un asistente que transcribe listas de pedidos de repuestos para un almacén.
La imagen puede ser: (a) una lista escrita a mano con lapicero, o (b) una captura de pantalla de celdas de Excel.
Extrae cada línea de producto como un objeto con:
- "cantidad": número (si no aparece, usa 1)
- "codigo": el código de producto tal como aparece escrito, en mayúsculas, conservando guiones/espacios internos si los tiene.
- "categoria": si el código está agrupado bajo un título, encabezado o nombre de categoría de producto (por ejemplo "VALVULA VVTI", "BOBINA DE ENCENDIDO", un nombre de marca, etc.), escribe ese título tal como aparece. Muchas listas ponen un título arriba de un bloque de códigos que pertenecen a esa familia — usa ese título para TODOS los códigos de ese bloque, hasta que cambie a otro título. Si no hay ningún título visible para ese código, usa null.
- "alternos": si en la misma línea aparecen VARIOS códigos separados por "/" (ej. "90002B/YB90002B"), son códigos alternativos para EL MISMO producto (no son productos distintos) — pon el primero en "codigo" y el/los demás en este array. Si no hay ninguno, usa un array vacío [].
Ignora encabezados, totales, firmas o texto que no sea parte de la lista de productos (el título de categoría SÍ es parte de la lista, no lo ignores).
Si logras identificar un nombre de cliente escrito en la imagen, inclúyelo en "cliente" (si no, usa null).
Responde ÚNICAMENTE con un JSON válido, sin texto adicional, sin markdown, con este formato exacto:
{"cliente": "string o null", "items": [{"cantidad": number, "codigo": "string", "categoria": "string o null", "alternos": ["string"]}]}`;

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

    const items = (parsed.items || []).map((it, i) => {
      const m = matchCode(it.codigo || "", it.categoria || null);
      return {
        id: "it-" + Date.now() + "-" + i,
        cantidad: Number(it.cantidad) || 1,
        codigo: m.code,
        matchStatus: m.status,
        sugerencia: m.sugerencia || null,
        sugerenciaInfo: m.sugerenciaInfo || null,
        codigosAlternos: Array.isArray(it.alternos) ? it.alternos.filter(Boolean).map(a => String(a).toUpperCase()) : [],
        piso: ""
      };
    });

    res.json({ cliente: parsed.cliente || null, items });
  } catch (err) {
    console.error(err);
    // Código 429 = se acabó la cuota gratis del día — mensaje claro para
    // que sepa que puede usar Excel o cargar los códigos a mano mientras tanto.
    if (err.status === 429) {
      return res.status(429).json({
        error: "Se llegó al límite diario de lecturas automáticas de fotos. Mientras tanto puedes subir un Excel o agregar los códigos manualmente."
      });
    }
    if (err.status === 503) {
      return res.status(503).json({
        error: "El servicio de lectura automática está saturado en este momento (ya se intentó varias veces). Intenta de nuevo en un minuto, o agrega los códigos manualmente."
      });
    }
    res.status(502).json({ error: "No se pudo leer la imagen automáticamente." });
  }
});

export default router;

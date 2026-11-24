import "dotenv/config";

// Cadena de modelos: se prueba en orden. Conviene que NO sean todos "flash-lite",
// porque se saturan juntos. Verifica que los nombres existan en tu cuenta.
const MODELOS = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash" // familia distinta: otra capacidad, menos probable que esté saturada
];

const INTENTOS_POR_MODELO = 3;   // intentos con el mismo modelo antes de pasar al siguiente
const ESPERA_BASE_MS = 1000;     // 1s, 2s, 4s... (+ aleatorio)
const TIMEOUT_MS = 25000;        // por si Gemini no responde nunca

const ES_REINTENTABLE = (status) => status === 503 || status === 429 || status === 500;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Espera exponencial con "jitter" (un poco de azar para no chocar con otros reintentos)
function esperaBackoff(intento) {
  return ESPERA_BASE_MS * 2 ** intento + Math.random() * 500;
}

export async function llamarGemini(armarBody) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Falta configurar GEMINI_API_KEY en el backend.");

  let ultimoStatus = null;
  let ultimaData = null;

  for (const modelo of MODELOS) {
    for (let intento = 0; intento < INTENTOS_POR_MODELO; intento++) {
      if (intento > 0) await esperar(esperaBackoff(intento - 1));

      let response, data;
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`;
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey // en header, no en la URL (así no queda en los logs)
          },
          body: JSON.stringify(armarBody(modelo)),
          signal: AbortSignal.timeout(TIMEOUT_MS)
        });
        data = await response.json();
      } catch (e) {
        // Error de red o timeout: se trata como reintentable
        ultimoStatus = 0;
        ultimaData = { error: { message: e.message } };
        console.error(`Gemini (${modelo}) falló de red/timeout:`, e.message);
        continue;
      }

      if (response.ok) return data;

      ultimoStatus = response.status;
      ultimaData = data;
      console.error(
        `Gemini (${modelo}) intento ${intento + 1}/${INTENTOS_POR_MODELO} respondió ${response.status}:`,
        data?.error?.message || data
      );

      // Errores como 400/401/403 no se arreglan reintentando ni cambiando de modelo
      if (!ES_REINTENTABLE(response.status)) {
        const error = new Error("El servicio de transcripción no respondió correctamente.");
        error.status = response.status;
        error.data = data;
        throw error;
      }
    }
    console.error(`Gemini: ${modelo} agotó sus intentos, probando el siguiente modelo...`);
  }

  const error = new Error("El servicio de transcripción no respondió correctamente.");
  error.status = ultimoStatus;
  error.data = ultimaData;
  throw error;
}

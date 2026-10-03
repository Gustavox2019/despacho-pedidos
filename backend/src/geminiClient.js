import "dotenv/config";

const MODELO_PRINCIPAL = "gemini-3.1-flash-lite";
const MODELO_RESPALDO = "gemini-3.5-flash-lite"; // se usa solo si el principal está saturado

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Llama a Gemini con reintento automático ante saturación (503 "high
// demand"). Reintenta un par de veces con el mismo modelo (con una
// pequeña espera), y si sigue saturado prueba con un modelo de respaldo
// antes de darse por vencido — así la mayoría de estos casos se
// resuelven solos, sin que el usuario vea el error.
//
// `armarBody(modelo)` recibe el nombre del modelo por si el llamador
// necesita ajustar algo según cuál se esté usando (normalmente no hace
// falta, solo se usa el mismo body para ambos).
export async function llamarGemini(armarBody) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Falta configurar GEMINI_API_KEY en el backend.");

  const intentos = [
    { modelo: MODELO_PRINCIPAL, esperaPrevia: 0 },
    { modelo: MODELO_PRINCIPAL, esperaPrevia: 1500 },
    { modelo: MODELO_PRINCIPAL, esperaPrevia: 3000 },
    { modelo: MODELO_RESPALDO, esperaPrevia: 0 }
  ];

  let ultimoStatus = null;
  let ultimaData = null;

  for (const intento of intentos) {
    if (intento.esperaPrevia) await esperar(intento.esperaPrevia);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${intento.modelo}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(armarBody(intento.modelo))
    });
    const data = await response.json();

    if (response.ok) return data;

    ultimoStatus = response.status;
    ultimaData = data;
    console.error(`Gemini (${intento.modelo}) respondió ${response.status}:`, data);

    // Solo tiene sentido reintentar cuando está "saturado" (503). Otros
    // errores (clave inválida, formato incorrecto, etc.) no se arreglan
    // reintentando — se corta de una vez.
    if (response.status !== 503) break;
  }

  const error = new Error("El servicio de transcripción no respondió correctamente.");
  error.status = ultimoStatus;
  error.data = ultimaData;
  throw error;
}

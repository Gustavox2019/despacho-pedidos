import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Catálogo enriquecido: [{ codigo, descripcion, familia (marca) }, ...]
const PRODUCTOS = JSON.parse(readFileSync(join(__dirname, "productos.json"), "utf-8"));

function normCode(s) {
  return (s || "").toUpperCase().replace(/[\s\-\._]/g, "");
}

// Para comparar texto libre (descripciones, nombres de categoría en una
// foto) — solo letras y números, sin tildes ni signos.
function normTexto(s) {
  return (s || "")
    .toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

// --- Índices que se arman una sola vez al arrancar el servidor ---

// Código normalizado → producto (para encontrar coincidencias exactas)
const CODE_INDEX = new Map();
// Descripción normalizada ("VALVULAVVTI") → lista de productos de esa familia
const FAMILIA_INDEX = new Map();
// Lista de todas las descripciones (para buscar a cuál se parece más un
// texto de categoría leído de una foto, ej. "VVTI" o "VALVULA VVTI")
const DESCRIPCIONES = [];

for (const p of PRODUCTOS) {
  const cn = normCode(p.codigo);
  if (!CODE_INDEX.has(cn)) CODE_INDEX.set(cn, p);

  const dn = normTexto(p.descripcion);
  if (dn) {
    if (!FAMILIA_INDEX.has(dn)) {
      FAMILIA_INDEX.set(dn, []);
      DESCRIPCIONES.push(dn);
    }
    FAMILIA_INDEX.get(dn).push(p);
  }
}

function levenshtein(a, b, maxDist) {
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > maxDist) return maxDist + 1;
  let prev = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    const curr = [i];
    let rowMin = curr[0];
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const val = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      curr.push(val);
      if (val < rowMin) rowMin = val;
    }
    if (rowMin > maxDist) return maxDist + 1;
    prev = curr;
  }
  return prev[lb];
}

// Busca, entre una lista de productos ya acotada, el que mejor calza con
// el código escrito — primero por si el código real "termina en" lo que
// se escribió (ej. escribieron "90002B" y el código real es "YB-90002B"),
// y si no, por cercanía de texto (para errores de tipeo/lectura).
function mejorEnGrupo(n, grupo, maxDist) {
  // 1) ¿Alguno TERMINA con lo que se escribió? (typeo de marca/prefijo)
  const porSufijo = grupo.filter(p => normCode(p.codigo).endsWith(n) && n.length >= 3);
  if (porSufijo.length === 1) return { producto: porSufijo[0], motivo: "prefijo" };

  // 2) Cercanía de texto (typeos, un dígito distinto, etc.)
  let best = null, bestDist = maxDist + 1;
  for (const p of grupo) {
    const cn = normCode(p.codigo);
    if (Math.abs(cn.length - n.length) > 2) continue;
    const d = levenshtein(n, cn, bestDist - 1);
    if (d < bestDist) { bestDist = d; best = p; if (d === 0) break; }
  }
  if (best && bestDist <= maxDist) return { producto: best, motivo: "similar" };
  return null;
}

// Encuentra a qué familia (descripción de catálogo) se parece más un
// texto de categoría leído de una imagen ("VALVULA VVTI", "VVTI", etc.)
function familiaMasParecida(categoria) {
  const c = normTexto(categoria);
  if (!c || c.length < 3) return null;
  if (FAMILIA_INDEX.has(c)) return FAMILIA_INDEX.get(c);
  // Coincidencia parcial: el texto de la foto contiene la descripción del
  // catálogo, o al revés (ej. foto dice "VVTI" y el catálogo "VALVULA VVTI").
  let mejor = null, mejorLargo = 0;
  for (const d of DESCRIPCIONES) {
    if ((c.includes(d) || d.includes(c)) && d.length > mejorLargo) {
      mejor = d;
      mejorLargo = d.length;
    }
  }
  return mejor ? FAMILIA_INDEX.get(mejor) : null;
}

// Busca el código real de un producto a partir de lo que se escribió/leyó.
//
// `categoria` es opcional: si al leer la lista (foto o Excel) se detectó
// un título/categoría cerca de ese código (ej. "VALVULA VVTI"), se usa
// para acotar la búsqueda SOLO a esa familia de productos — así, aunque
// el código esté incompleto (le falte el prefijo de marca), se puede
// reconocer con confianza en vez de comparar contra los 20 mil códigos.
//
// Devuelve:
//   - status "exacto"       → ya está bien tal cual, se puede usar directo
//   - status "sugerido"     → probablemente sea otro código, pero NO se
//                             reemplaza solo — se deja el texto original y
//                             se informa el candidato en "sugerencia" para
//                             que la persona decida.
//   - status "no_encontrado"→ no se encontró nada parecido
export function matchCode(raw, categoria) {
  const n = normCode(raw);
  if (!n) return { code: raw, status: "vacio" };

  const exacto = CODE_INDEX.get(n);
  if (exacto) return { code: exacto.codigo, status: "exacto" };

  // 1) Si hay pista de categoría, buscar SOLO dentro de esa familia —
  // mucho más confiable que comparar contra todo el catálogo.
  const grupo = categoria ? familiaMasParecida(categoria) : null;
  if (grupo && grupo.length) {
    const encontrado = mejorEnGrupo(n, grupo, 2);
    if (encontrado) {
      return {
        code: raw, // el texto original NO se toca
        status: "sugerido",
        sugerencia: encontrado.producto.codigo,
        sugerenciaInfo: { descripcion: encontrado.producto.descripcion, familia: encontrado.producto.familia }
      };
    }
  }

  // 2) Sin pista de categoría (o no se encontró nada ahí): búsqueda
  // general, pero con tolerancia más estricta (distancia 1) — con miles
  // de códigos parecidos entre sí, una tolerancia amplia termina
  // sugiriendo productos que no tienen nada que ver.
  let best = null, bestDist = 2;
  for (const [cn, p] of CODE_INDEX) {
    if (Math.abs(cn.length - n.length) > 1) continue;
    const d = levenshtein(n, cn, bestDist - 1);
    if (d < bestDist) { bestDist = d; best = p; if (d === 0) break; }
  }
  if (best) {
    return {
      code: raw,
      status: "sugerido",
      sugerencia: best.codigo,
      sugerenciaInfo: { descripcion: best.descripcion, familia: best.familia }
    };
  }

  return { code: raw, status: "no_encontrado" };
}

// Lista plana de códigos (compatibilidad con lo que ya usaba el resto del
// backend, por ejemplo el autocompletado).
export const CODIGOS_PRODUCTOS = PRODUCTOS.map(p => p.codigo);

// Sugerencias para autocompletar mientras alguien escribe un código a mano.
// Ahora también muestra la descripción, para ayudar a confirmar que es el
// producto correcto (ej. "YB-90002B — VALVULA VVTI").
export function buscarCodigos(query, limite = 8) {
  const q = normCode(query);
  if (!q) return [];
  const prefijo = [];
  const contiene = [];
  for (const p of PRODUCTOS) {
    const n = normCode(p.codigo);
    if (n.startsWith(q)) {
      prefijo.push(p);
      if (prefijo.length >= limite) break;
    } else if (contiene.length < limite && n.includes(q)) {
      contiene.push(p);
    }
  }
  return [...prefijo, ...contiene].slice(0, limite)
    .map(p => ({ codigo: p.codigo, descripcion: p.descripcion, familia: p.familia }));
}

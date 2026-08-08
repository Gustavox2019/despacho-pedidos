import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CODIGOS_PRODUCTOS = JSON.parse(readFileSync(join(__dirname, "codigos.json"), "utf-8"));

function normCode(s) {
  return (s || "").toUpperCase().replace(/[\s\-\._]/g, "");
}

const CODE_INDEX = (() => {
  const map = new Map();
  for (const c of CODIGOS_PRODUCTOS) {
    const n = normCode(c);
    if (!map.has(n)) map.set(n, c);
  }
  return map;
})();

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

// Encuentra el código real más parecido en el catálogo
export function matchCode(raw) {
  const n = normCode(raw);
  if (!n) return { code: raw, status: "vacio" };
  if (CODE_INDEX.has(n)) return { code: CODE_INDEX.get(n), status: "exacto" };
  let best = null, bestDist = 3;
  for (const [cn, orig] of CODE_INDEX) {
    if (Math.abs(cn.length - n.length) > 2) continue;
    const d = levenshtein(n, cn, bestDist - 1);
    if (d < bestDist) { bestDist = d; best = orig; if (d === 0) break; }
  }
  if (best) return { code: best, status: "aproximado" };
  return { code: raw, status: "no_encontrado" };
}

export { CODIGOS_PRODUCTOS };

import * as XLSX from "xlsx";

const PALABRAS_ENCABEZADO = [
  "cantidad", "cant", "cnt", "qty", "codigo", "código", "code", "producto", "item", "descripcion", "descripción"
];

function esNumero(s) {
  return /^\d+([.,]\d+)?$/.test(s);
}

// Lee un .xlsx/.xls/.csv y devuelve pares {cantidad, codigo} — detecta y
// salta la fila de encabezado si existe, y acepta tanto "cantidad | código"
// como listas de un solo código por fila.
export async function parsearExcel(file) {
  const buffer = await file.arrayBuffer();
  const libro = XLSX.read(buffer, { type: "array" });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: "" });

  const items = [];
  for (const fila of filas) {
    const celdas = fila.map(c => String(c ?? "").trim()).filter(c => c !== "");
    if (celdas.length === 0) continue;

    const esEncabezado = celdas.some(c => PALABRAS_ENCABEZADO.includes(c.toLowerCase()));
    if (esEncabezado) continue;

    let cantidad = 1, codigo = "";
    if (celdas.length === 1) {
      codigo = celdas[0];
    } else {
      const [a, b] = celdas;
      if (esNumero(a)) { cantidad = Math.round(parseFloat(a.replace(",", "."))) || 1; codigo = b; }
      else if (esNumero(b)) { cantidad = Math.round(parseFloat(b.replace(",", "."))) || 1; codigo = a; }
      else { codigo = a; }
    }
    if (codigo) items.push({ cantidad, codigo });
  }
  return items;
}

import * as XLSX from "xlsx";

// Quita tildes, apóstrofes, puntos, espacios, etc. para poder comparar
// encabezados sin importar cómo estén escritos: "Q'TY", "PART No.",
// "Código", "COD." → todos se normalizan a algo comparable.
function normalizar(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// Encabezados típicos de la columna de código de producto.
const PALABRAS_CODIGO = [
  "codigo", "cod", "code", "sku", "referencia", "ref", "modelo",
  "partno", "partnumber", "pn", "parteno", "itemcode", "itemno",
  "productcode", "codproducto", "codart", "codigoarticulo"
];

// Encabezados típicos de la columna de cantidad.
const PALABRAS_CANTIDAD = [
  "cantidad", "cant", "cnt", "qty", "uds", "unidades", "unid", "units",
  "cantidadpedida", "qtypedido", "qtyped"
];

function esNumero(s) {
  return /^\d+([.,]\d+)?$/.test(s);
}

// Busca, entre las primeras filas de la hoja, una fila de encabezado real
// (con columnas tipo "PART No.", "Q'TY", "Código", "Cantidad", etc.) y
// devuelve en qué columna está el código y en cuál la cantidad.
function detectarEncabezado(filas) {
  let mejor = null;
  const limite = Math.min(filas.length, 30);
  for (let i = 0; i < limite; i++) {
    const fila = filas[i];
    let colCodigo = -1, colCantidad = -1;
    for (let c = 0; c < fila.length; c++) {
      const norm = normalizar(fila[c]);
      if (!norm) continue;
      if (colCodigo === -1 && PALABRAS_CODIGO.includes(norm)) colCodigo = c;
      if (colCantidad === -1 && PALABRAS_CANTIDAD.includes(norm)) colCantidad = c;
    }
    if (colCodigo !== -1) {
      const score = 1 + (colCantidad !== -1 ? 1 : 0);
      if (!mejor || score > mejor.score) mejor = { fila: i, colCodigo, colCantidad, score };
      if (score === 2) break; // no hay nada mejor que encontrar ambas columnas
    }
  }
  return mejor;
}

// Lee un .xlsx/.xls/.csv y devuelve pares {cantidad, codigo}.
//
// 1) Primero intenta encontrar un encabezado real en la hoja (columnas como
//    "PART No.", "Q'TY", "Código", "Cantidad", "SKU", "Referencia", etc,
//    sin importar el orden ni cuántas otras columnas haya en el medio,
//    como en un packing list con "C/NO.", "PACKAGE", "PART No.", "Q'TY").
// 2) Si no encuentra encabezado, cae al modo simple de antes: listas de un
//    solo código por línea, o pares "cantidad | código".
export async function parsearExcel(file) {
  const buffer = await file.arrayBuffer();
  const libro = XLSX.read(buffer, { type: "array" });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const filasRaw = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: "" });
  const filas = filasRaw.map(fila => fila.map(c => String(c ?? "").trim()));

  const encabezado = detectarEncabezado(filas);
  const items = [];

  if (encabezado) {
    for (let i = encabezado.fila + 1; i < filas.length; i++) {
      const fila = filas[i];
      const codigo = (fila[encabezado.colCodigo] || "").trim();
      if (!codigo) continue;
      if (PALABRAS_CODIGO.includes(normalizar(codigo))) continue; // encabezado repetido
      let cantidad = 1;
      if (encabezado.colCantidad !== -1) {
        const crudo = (fila[encabezado.colCantidad] || "").trim();
        const num = parseFloat(crudo.replace(",", "."));
        if (!isNaN(num) && num > 0) cantidad = Math.round(num);
      }
      items.push({ cantidad, codigo });
    }
    return items;
  }

  // --- Modo simple (sin encabezado detectado) ---
  const PALABRAS_ENCABEZADO_SIMPLE = [
    "cantidad", "cant", "cnt", "qty", "codigo", "código", "code", "producto", "item", "descripcion", "descripción"
  ];
  for (const fila of filas) {
    const celdas = fila.filter(c => c !== "");
    if (celdas.length === 0) continue;

    const esFilaEncabezado = celdas.some(c => PALABRAS_ENCABEZADO_SIMPLE.includes(c.toLowerCase()));
    if (esFilaEncabezado) continue;

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

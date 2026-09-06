import * as XLSX from "xlsx";

const PALABRAS_ENCABEZADO = [
  "cantidad", "cant", "cnt", "qty", "codigo", "código", "code", "producto", "item", "descripcion", "descripción"
];

function esNumero(s) {
  return /^\d+([.,]\d+)?$/.test(s);
}

// Si el código viene como "90002B/YB90002B", son códigos alternativos
// para el MISMO producto (no productos distintos) — se guarda el primero
// como código principal y el resto en "codigosAlternos".
function separarAlternos(codigo) {
  const partes = codigo.split("/").map(p => p.trim()).filter(Boolean);
  return { codigo: partes[0] || codigo, codigosAlternos: partes.slice(1) };
}

function filasAItems(filas) {
  const items = [];
  for (const fila of filas) {
    const celdas = fila.map(c => String(c ?? "").trim()).filter(c => c !== "");
    if (celdas.length === 0) continue;

    const esEncabezado = celdas.some(c => PALABRAS_ENCABEZADO.includes(c.toLowerCase()));
    if (esEncabezado) continue;

    let cantidad = 1, codigoCrudo = "";
    if (celdas.length === 1) {
      codigoCrudo = celdas[0];
    } else {
      const [a, b] = celdas;
      if (esNumero(a)) { cantidad = Math.round(parseFloat(a.replace(",", "."))) || 1; codigoCrudo = b; }
      else if (esNumero(b)) { cantidad = Math.round(parseFloat(b.replace(",", "."))) || 1; codigoCrudo = a; }
      else { codigoCrudo = a; }
    }
    if (codigoCrudo) {
      const { codigo, codigosAlternos } = separarAlternos(codigoCrudo);
      items.push({ cantidad, codigo, codigosAlternos });
    }
  }
  return items;
}

// Respaldo manual: lee el archivo como texto plano y separa por el
// delimitador más probable (punto y coma, coma, o tabulación). Se usa
// cuando la librería de Excel no logra interpretar el archivo (por
// ejemplo un .csv con una codificación rara).
async function parsearComoTextoCSV(file) {
  const texto = await file.text();
  const lineas = texto.split(/\r\n|\n|\r/).filter(l => l.trim() !== "");
  if (lineas.length === 0) return [];

  const delimitador = [";", ",", "\t"].reduce((mejor, d) =>
    (lineas[0].split(d).length > lineas[0].split(mejor).length ? d : mejor), ";");

  const filas = lineas.map(linea =>
    linea.split(delimitador).map(c => c.replace(/^"|"$/g, "").trim())
  );
  return filasAItems(filas);
}

// Lee un .xlsx/.xls/.csv y devuelve pares {cantidad, codigo} — detecta y
// salta la fila de encabezado si existe, y acepta tanto "cantidad | código"
// como listas de un solo código por fila. Si la lectura como Excel falla
// o no encuentra nada, se cae a leerlo como texto CSV plano.
export async function parsearExcel(file) {
  try {
    const buffer = await file.arrayBuffer();
    const libro = XLSX.read(buffer, { type: "array" });
    const hoja = libro.Sheets[libro.SheetNames[0]];
    const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: "" });
    const items = filasAItems(filas);
    if (items.length > 0) return items;
    // no se reconoció nada como Excel — intenta como CSV de texto plano
    return await parsearComoTextoCSV(file);
  } catch (err) {
    return await parsearComoTextoCSV(file);
  }
}

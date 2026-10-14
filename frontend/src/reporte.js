import ExcelJS from "exceljs";

function fechaCorta(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("es-PE", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function isoDia(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}

const ENCABEZADO = [
  "Fecha", "ID Pedido", "Cliente", "Vendedor", "Almacenero", "Cajas",
  "Cantidad", "Codigo", "Piso", "Check", "Detalle"
];

// Arma las filas planas (una por producto separado) de los pedidos
// finalizados, agrupadas por fecha — sirve tanto para CSV como para Excel.
// filtro: { fechaDesde, fechaHasta, cliente } — todo opcional; sin fechas = toda la data.
function construirFilas(pedidos, filtro = {}) {
  const { fechaDesde, fechaHasta, cliente } = filtro;

  let finalizados = pedidos.filter(p => p.estado === "finalizado" || p.estado === "despachado");

  if (fechaDesde || fechaHasta) {
    finalizados = finalizados.filter(p => {
      const iso = isoDia(p.finalizadoEn || p.creadoEn);
      if (fechaDesde && iso < fechaDesde) return false;
      if (fechaHasta && iso > fechaHasta) return false;
      return true;
    });
  }
  if (cliente && cliente.trim()) {
    const q = cliente.trim().toLowerCase();
    finalizados = finalizados.filter(p => p.cliente.toLowerCase().includes(q));
  }

  finalizados.sort((a, b) => (a.finalizadoEn || a.creadoEn) - (b.finalizadoEn || b.creadoEn));

  const filas = [ENCABEZADO];
  for (const p of finalizados) {
    const fecha = fechaCorta(p.finalizadoEn || p.creadoEn);
    for (const it of p.items) {
      filas.push([
        fecha,
        p.id,
        p.cliente,
        p.vendedorNombre,
        p.almaceneroNombre || "",
        p.cajas || "",
        it.cantidad,
        it.codigo,
        it.piso || "",
        it.check === "ok" ? "OK" : it.check === "no" ? "NO" : "",
        it.texto || ""
      ]);
    }
  }
  return filas;
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (s.includes(";") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function nombreArchivo(ext) {
  const hoy = new Date().toISOString().slice(0, 10);
  return `reporte-pedidos-${hoy}.${ext}`;
}

// Dispara la descarga de un archivo ya armado en memoria (ArrayBuffer/Blob).
function descargarBuffer(buffer, nombre, mime) {
  const blob = new Blob([buffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nombre;
  link.click();
  URL.revokeObjectURL(url);
}

const ROJO = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5D0D0" } };
const ROJO_TEXTO = { color: { argb: "FFB3261E" }, bold: true };

// Agrega las filas a una hoja de exceljs y resalta en rojo cualquier celda
// de la columna "Check" que diga "NO" (se identifica por el encabezado
// exacto, así sirve tanto para el reporte general como para el de un pedido).
function escribirFilasConResaltado(hoja, filas) {
  const encabezado = filas[0];
  const colCheck = encabezado.findIndex(h => String(h).toLowerCase() === "check");
  filas.forEach((fila, i) => {
    const row = hoja.addRow(fila);
    if (i === 0) {
      row.font = { bold: true };
      return;
    }
    if (colCheck !== -1) {
      const celda = row.getCell(colCheck + 1);
      if (String(celda.value).toUpperCase() === "NO") {
        celda.fill = ROJO;
        celda.font = ROJO_TEXTO;
      }
    }
  });
}

// CSV (se abre directo en Excel / Google Sheets) — el color no existe en
// texto plano, así que en CSV la columna Check se mantiene solo como texto.
export function exportarReporteCSV(pedidos, filtro) {
  const filas = construirFilas(pedidos, filtro);
  const csv = "﻿" + filas.map(fila => fila.map(csvEscape).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nombreArchivo("csv");
  link.click();
  URL.revokeObjectURL(url);
}

// Excel real (.xlsx), con columnas ajustadas y la columna "Check" en rojo
// cuando dice "NO".
export async function exportarReporteXLSX(pedidos, filtro) {
  const filas = construirFilas(pedidos, filtro);
  const workbook = new ExcelJS.Workbook();
  const hoja = workbook.addWorksheet("Pedidos");
  hoja.columns = [
    { width: 11 }, { width: 11 }, { width: 22 }, { width: 18 }, { width: 18 }, { width: 7 },
    { width: 9 }, { width: 16 }, { width: 10 }, { width: 7 }, { width: 24 }
  ];
  escribirFilasConResaltado(hoja, filas);
  const buffer = await workbook.xlsx.writeBuffer();
  descargarBuffer(buffer, nombreArchivo("xlsx"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

// Exporta UN solo pedido a Excel (para el vendedor o el almacén, con el
// detalle completo del checklist tal como quedó) — también con la columna
// "Check" en rojo cuando dice "NO".
export async function exportarPedidoXLSX(pedido) {
  const filas = [
    ["Pedido", pedido.id],
    ["Cliente", pedido.cliente],
    ["Vendedor", pedido.vendedorNombre || ""],
    ["Almacenero", pedido.almaceneroNombre || ""],
    ["Tipo", pedido.tipo === "confirmar" ? "Confirmar" : "Separar"],
    ["Estado", pedido.estado],
    ["Cajas", pedido.cajas || ""],
    ["Creado", fechaCorta(pedido.creadoEn)],
    ["Finalizado", pedido.finalizadoEn ? fechaCorta(pedido.finalizadoEn) : ""],
    []
  ];
  const filaEncabezado = ["Cantidad", "Codigo", "Check", "Detalle"];
  const filasItems = [filaEncabezado];
  for (const it of pedido.items) {
    const codigoCompleto = it.codigosAlternos && it.codigosAlternos.length > 0
      ? `${it.codigoUsado || it.codigo} / ${it.codigosAlternos.filter(a => a !== it.codigoUsado).join(" / ")}`
      : it.codigo;
    filasItems.push([
      it.cantidad,
      codigoCompleto,
      it.check === "ok" ? "OK" : it.check === "no" ? "NO" : "",
      it.texto || ""
    ]);
  }

  const workbook = new ExcelJS.Workbook();
  const hoja = workbook.addWorksheet(pedido.id);
  hoja.columns = [{ width: 14 }, { width: 24 }, { width: 8 }, { width: 30 }];
  filas.forEach(fila => hoja.addRow(fila));
  escribirFilasConResaltado(hoja, filasItems);
  const buffer = await workbook.xlsx.writeBuffer();
  descargarBuffer(buffer, `${pedido.id}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}
